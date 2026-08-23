import asyncio
import sys

from fastapi.testclient import TestClient

from app.main import app


def main() -> int:
    with TestClient(app) as client:
        r = client.get("/api/health")
        assert r.status_code == 200, r.text
        print("health:", r.json())

        r = client.get("/api/subjects", headers={"Authorization": "dev 900001"})
        assert r.status_code == 200, r.text
        subjects = r.json()
        assert len(subjects) >= 25, f"seed failed: {len(subjects)}"
        print(f"subjects seeded: {len(subjects)}")

        me = client.get("/api/me", headers={"Authorization": "dev 900001"}).json()
        print("me:", me["id"][:8], "tg:", me["telegram_id"])

        upd = {"full_name": "Тестов Тест Тестович", "course": 2, "group_name": "БИ23-5", "program": "БИ"}
        r = client.patch("/api/me", json=upd, headers={"Authorization": "dev 900001"})
        assert r.status_code == 200 and r.json()["full_name"].startswith("Тестов"), r.text
        print("profile updated")

        sub_id = next(s["id"] for s in subjects if s["course"] == 2)
        from datetime import datetime, timedelta, timezone

        deadline = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        order_body = {
            "subject_id": sub_id,
            "category": "lab",
            "title": "Лабораторная №3: SQL-запросы",
            "description": "5 запросов + отчёт",
            "price_rub": 1500,
            "deadline": deadline,
        }
        r = client.post("/api/orders", json=order_body, headers={"Authorization": "dev 900001"})
        assert r.status_code == 201, r.text
        order = r.json()
        print("order created:", order["id"][:8], "status:", order["status"], "price_kop:", order["price_kop"])
        assert order["status"] == "awaiting_payment"
        assert order["price_kop"] == 150000

        feed = client.get("/api/orders/feed", headers={"Authorization": "dev 900002"}).json()
        assert len(feed) == 0, "awaiting_payment must not appear in feed"

        r = client.post(
            f"/api/orders/{order['id']}/take",
            headers={"Authorization": "dev 900002"},
        )
        assert r.status_code == 403, "executor without approved profile must be rejected"

        client.patch(
            "/api/me",
            json={"full_name": "Исполнитель Исп", "course": 3, "program": "БИ"},
            headers={"Authorization": "dev 900002"},
        )
        r = client.post("/api/me/executor-apply", headers={"Authorization": "dev 900002"})
        assert r.status_code == 200 and r.json()["status"] == "pending", r.text

        import uuid

        import sqlalchemy as sa
        from app.db import SessionLocal
        from app.models import ExecutorProfile, ExecutorStatus, User

        async def approve():
            async with SessionLocal() as s:
                uid = (
                    await s.execute(sa.select(User.id).where(User.telegram_id == 900002))
                ).scalar_one()
                p = (
                    await s.execute(
                        sa.select(ExecutorProfile).where(ExecutorProfile.user_id == uid)
                    )
                ).scalar_one()
                p.status = ExecutorStatus.approved
                await s.commit()

        asyncio.run(approve())

        r = client.post(f"/api/orders/{order['id']}/deliver", headers={"Authorization": "dev 900002"})
        assert r.status_code == 403, "cannot deliver before take"

        r = client.post(f"/api/orders/{order['id']}/pay", headers={"Authorization": "dev 900001"})
        assert r.status_code == 200 and r.json()["status"] == "paid", r.text
        print("paid -> escrow")

        feed = client.get("/api/orders/feed", headers={"Authorization": "dev 900002"}).json()
        assert any(o["id"] == order["id"] for o in feed), "paid order must be in feed"

        r = client.post(f"/api/orders/{order['id']}/take", headers={"Authorization": "dev 900002"})
        assert r.status_code == 200 and r.json()["status"] == "in_work", r.text
        print("taken -> in_work")

        r = client.post(f"/api/orders/{order['id']}/deliver", headers={"Authorization": "dev 900002"})
        assert r.status_code == 200 and r.json()["status"] == "delivered", r.text
        assert r.json()["auto_confirm_at"] is not None
        print("delivered, auto_confirm set")

        mine = client.get("/api/orders/mine?role=customer", headers={"Authorization": "dev 900001"}).json()
        assert any(o["id"] == order["id"] for o in mine)

        r = client.post(f"/api/orders/{order['id']}/complete", headers={"Authorization": "dev 900001"})
        assert r.status_code == 200 and r.json()["status"] == "completed", r.text
        print("completed")

        r = client.post(
            f"/api/orders/{order['id']}/review",
            json={"rating": 5, "comment": "Быстро и чисто"},
            headers={"Authorization": "dev 900001"},
        )
        assert r.status_code == 201, r.text

        executor_me = client.get("/api/me", headers={"Authorization": "dev 900002"}).json()
        assert executor_me["rating_num"] == 5.0 and executor_me["completed_orders"] == 1, executor_me
        print("review ok, executor rating:", executor_me["rating_num"], "done:", executor_me["completed_orders"])

    print("SMOKE OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
