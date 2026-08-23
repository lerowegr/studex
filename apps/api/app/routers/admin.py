import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import get_current_user
from app.db import get_session
from app.models import Dispute, DisputeStatus, Order, OrderStatus, Transaction, TxStatus, TxType, User
from app.services.notify import notify

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user


class DisputeOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    opened_by: uuid.UUID
    reason: str
    status: str
    resolution_note: str | None


class ResolveBody(BaseModel):
    outcome: str
    note: str | None = None


@router.get("/disputes", response_model=list[DisputeOut])
async def list_disputes(
    admin: User = Depends(require_admin),
    session=Depends(get_session),
):
    rows = (
        await session.execute(
            sa.select(Dispute).order_by(Dispute.created_at.desc()).limit(100)
        )
    ).scalars().all()
    return [
        DisputeOut(
            id=d.id,
            order_id=d.order_id,
            opened_by=d.opened_by,
            reason=d.reason,
            status=DisputeStatus(d.status).value,
            resolution_note=d.resolution_note,
        )
        for d in rows
    ]


@router.post("/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: uuid.UUID,
    body: ResolveBody,
    admin: User = Depends(require_admin),
    session=Depends(get_session),
):
    dispute = (
        await session.execute(sa.select(Dispute).where(Dispute.id == dispute_id))
    ).scalar_one_or_none()
    if dispute is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dispute not found")

    mapping = {
        "executor": (DisputeStatus.resolved_executor, OrderStatus.completed),
        "customer": (DisputeStatus.resolved_customer, OrderStatus.refunded),
        "split": (DisputeStatus.resolved_split, OrderStatus.completed),
    }
    if body.outcome not in mapping:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "outcome: executor|customer|split")
    dispute_status, order_status = mapping[body.outcome]

    order = (
        await session.execute(sa.select(Order).where(Order.id == dispute.order_id))
    ).scalar_one()
    if order.status != OrderStatus.disputed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Order is not in disputed state")

    if order_status == OrderStatus.completed:
        payout_full = int(round(order.price_kop * (1 - float(order.commission_rate))))
        amount = payout_full // 2 if body.outcome == "split" else payout_full
        hold = (
            await session.execute(
                sa.select(Transaction).where(
                    Transaction.order_id == order.id,
                    Transaction.type == TxType.escrow_hold,
                    Transaction.status == TxStatus.pending,
                )
            )
        ).scalar_one_or_none()
        if hold is not None:
            hold.status = TxStatus.succeeded
        commission = max(order.price_kop - amount, 0)
        session.add_all(
            [
                Transaction(
                    order_id=order.id,
                    user_id=order.executor_id,
                    type=TxType.payout,
                    amount_kop=amount,
                    status=TxStatus.pending,
                ),
                Transaction(
                    order_id=order.id,
                    user_id=None,
                    type=TxType.commission,
                    amount_kop=commission,
                    status=TxStatus.succeeded,
                ),
            ]
        )
        if order.executor_id:
            await notify(
                session,
                order.executor_id,
                "dispute_resolved",
                f"Спор решён в твою пользу. Выплата: {amount // 100} ₽",
                push=True,
            )
        await notify(
            session,
            order.customer_id,
            "dispute_resolved",
            "Спор рассмотрен. Проверь детали сделки в приложении.",
            push=True,
        )
    else:
        hold = (
            await session.execute(
                sa.select(Transaction).where(
                    Transaction.order_id == order.id,
                    Transaction.type == TxType.escrow_hold,
                    Transaction.status == TxStatus.pending,
                )
            )
        ).scalar_one_or_none()
        if hold is not None:
            hold.status = TxStatus.failed
        session.add(
            Transaction(
                order_id=order.id,
                user_id=order.customer_id,
                type=TxType.refund,
                amount_kop=order.price_kop,
                status=TxStatus.pending,
            )
        )
        await notify(
            session,
            order.customer_id,
            "dispute_resolved",
            f"Спор решён в твою пользу. Возврат {order.price_kop // 100} ₽.",
            push=True,
        )

    dispute.status = dispute_status
    dispute.resolution_note = body.note
    dispute.resolved_by = admin.id
    dispute.resolved_at = datetime.now(timezone.utc)

    order.status = order_status
    order.completed_at = datetime.now(timezone.utc)
    if order_status == OrderStatus.completed and order.executor_id and body.outcome == "executor":
        executor = (
            await session.execute(sa.select(User).where(User.id == order.executor_id))
        ).scalar_one()
        executor.completed_orders += 1

    await session.commit()
    return {"ok": True, "status": DisputeStatus(dispute_status).value}


@router.get("/stats")
async def stats(
    _admin: User = Depends(require_admin),
    session=Depends(get_session),
):
    async def count(model, where=None):
        stmt = sa.select(sa.func.count()).select_from(model)
        if where is not None:
            stmt = stmt.where(where)
        return (await session.execute(stmt)).scalar_one()

    return {
        "users": await count(User),
        "orders_total": await count(Order),
        "orders_open": await count(Order, Order.status.in_([OrderStatus.paid])),
        "orders_completed": await count(Order, Order.status == OrderStatus.completed),
        "orders_disputed": await count(Order, Order.status == OrderStatus.disputed),
        "disputes_open": await count(Dispute, Dispute.status == DisputeStatus.open),
        "gmv_kop": (
            await session.execute(
                sa.select(sa.func.coalesce(sa.func.sum(Order.price_kop), 0)).where(
                    Order.status == OrderStatus.completed
                )
            )
        ).scalar_one(),
    }


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: uuid.UUID,
    reason: str = "Нарушение правил",
    admin: User = Depends(require_admin),
    session=Depends(get_session),
):
    target = (
        await session.execute(sa.select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    target.is_banned = True
    target.ban_reason = reason[:500]
    await session.commit()
    return {"ok": True}
