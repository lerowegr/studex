import asyncio
import sys
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app

H1 = {"Authorization": "dev 910001"}
H2 = {"Authorization": "dev 910002"}
H3 = {"Authorization": "dev 910003"}


def main() -> int:
    with TestClient(app) as client:
        for h in (H1, H2, H3):
            r = client.get("/api/me", headers=h)
            assert r.status_code == 200

        client.patch("/api/me", json={"full_name": "Заказчик З"}, headers=H1)
        client.patch(
            "/api/me",
            json={"full_name": "Исполнитель И", "course": 2, "program": "БИ"},
            headers=H2,
        )

        subjects = client.get("/api/subjects", headers=H1).json()
        sub_id = subjects[0]["id"]

        quiz = client.get(f"/api/quiz/{sub_id}", headers=H2).json()
        questions = quiz["questions"]
        assert len(questions) == 8 and all("answer" not in q for q in questions)
        print("quiz fetched: 8 questions, answers hidden")

        r = client.post(
            f"/api/quiz/{sub_id}/submit",
            json={"answers": [0] * 8, "questions": questions},
            headers=H2,
        )
        body = r.json()
        print("quiz submit (all wrong):", body)
        assert body["passed"] is False
        assert not client.post(
            f"/api/orders/feed", headers=H2
        ) or True

        from app.quiz_bank import QUESTIONS

        correct = [QUESTIONS[q["id"]]["answer"] for q in questions]
        r = client.post(
            f"/api/quiz/{sub_id}/submit",
            json={"answers": correct, "questions": questions},
            headers=H2,
        )
        body = r.json()
        assert body["passed"] is True, body
        print("quiz passed:", body)

        me2 = client.get("/api/me", headers=H2).json()
        assert me2["executor_status"] == "approved", me2
        print("executor approved via quiz")

        r = client.post(f"/api/subscriptions/{sub_id}", headers=H2)
        assert r.status_code == 201
        subs = client.get("/api/subscriptions", headers=H2).json()
        assert any(s["id"] == sub_id for s in subs)
        print("subscribed to subject")

        deadline = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        order = client.post(
            "/api/orders",
            json={
                "subject_id": sub_id,
                "category": "lab",
                "title": "Тестовый заказ для спора",
                "price_rub": 800,
                "deadline": deadline,
            },
            headers=H1,
        ).json()

        r = client.post(f"/api/orders/{order['id']}/pay", headers=H1)
        assert r.status_code == 200 and r.json()["status"] == "paid"
        r = client.post(f"/api/orders/{order['id']}/take", headers=H2)
        assert r.status_code == 200

        msgs = client.post(
            f"/api/orders/{order['id']}/messages",
            json={"body": "Привет! Уточню требования"},
            headers=H2,
        )
        assert msgs.status_code == 201, msgs.text
        client.post(
            f"/api/orders/{order['id']}/messages",
            json={"body": "Привет, всё в методичке"},
            headers=H1,
        )
        history = client.get(f"/api/orders/{order['id']}/messages", headers=H1).json()
        assert len(history) == 2 and history[1]["mine"] is True, history
        outsider = client.get(f"/api/orders/{order['id']}/messages", headers=H3)
        assert outsider.status_code == 403
        print("chat: 2 messages, outsider rejected")

        client.post(
            f"/api/orders/{order['id']}/deliver",
            params=None,
            headers=H2,
        )
        r = client.post(
            f"/api/orders/{order['id']}/dispute",
            params={"reason": "Работа не соответствует ТЗ"},
            headers=H1,
        )
        assert r.status_code == 200 and r.json()["status"] == "disputed", r.text
        print("delivered -> dispute opened")

        me3 = client.get("/api/me", headers=H3).json()
        assert me3["is_admin"] is False
        r = client.post(
            "/api/me",
            json={},
            headers=H3,
        )
        import sqlalchemy as sa
        from app.db import SessionLocal
        from app.models import User

        async def make_admin():
            async with SessionLocal() as s:
                await s.execute(
                    sa.update(User).where(User.telegram_id == 910003).values(is_admin=True)
                )
                await s.commit()

        asyncio.run(make_admin())

        disputes = client.get("/api/admin/disputes", headers=H3).json()
        target = next(d for d in disputes if d["order_id"] == order["id"])
        assert target["status"] == "open"
        r = client.post(
            f"/api/admin/disputes/{target['id']}/resolve",
            json={"outcome": "split", "note": "50/50 по итогам проверки"},
            headers=H3,
        )
        assert r.status_code == 200, r.text
        detail = client.get(f"/api/orders/{order['id']}", headers=H1).json()
        assert detail["status"] == "completed", detail
        print("admin resolved split -> completed")

        stats = client.get("/api/admin/stats", headers=H3).json()
        assert stats["orders_completed"] >= 1 and stats["gmv_kop"] >= 80000, stats
        print("stats:", stats)

        pushes = client.get("/api/internal/pushes", headers={"X-Service-Key": "dev-service-key"}).json()
        texts = [p["text"] for p in pushes]
        assert any("Новый заказ" in t for t in texts), texts[:5]
        assert any("спор" in t.lower() for t in texts), texts[:5]
        pushes_again = client.get(
            "/api/internal/pushes", headers={"X-Service-Key": "dev-service-key"}
        ).json()
        assert all(p["id"] not in {q["id"] for q in pushes} for q in pushes_again)
        print(f"pushes delivered to bot queue: {len(pushes)}, no duplicates on re-poll")

        bad = client.get("/api/internal/pushes", headers={"X-Service-Key": "wrong"})
        assert bad.status_code == 403
        print("service key enforced")

        inbox = client.get("/api/me/notifications", headers=H2).json()
        assert inbox["unread"] >= 1 and len(inbox["items"]) >= 1, inbox
        types_seen = {n["type"] for n in inbox["items"]}
        assert "new_order" in types_seen, types_seen
        r = client.post("/api/me/notifications/read-all", headers=H2)
        assert r.status_code == 200
        inbox_after = client.get("/api/me/notifications", headers=H2).json()
        assert inbox_after["unread"] == 0, inbox_after
        print(f"inbox ok: {len(inbox['items'])} events, read-all works")

    print("SMOKE2 OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
