import asyncio
import logging
from datetime import datetime, timezone

import sqlalchemy as sa

from app.config import get_settings
from app.db import SessionLocal
from app.models import Order, OrderStatus, Transaction, TxStatus, TxType, User
from app.services.notify import notify

settings = get_settings()
log = logging.getLogger("studex.scheduler")


async def auto_confirm_orders() -> int:
    now = datetime.now(timezone.utc)
    async with SessionLocal() as session:
        orders = (
            await session.execute(
                sa.select(Order).where(
                    Order.status == OrderStatus.delivered,
                    Order.auto_confirm_at.is_not(None),
                    Order.auto_confirm_at <= now,
                )
            )
        ).scalars().all()

        for order in orders:
            order.status = OrderStatus.completed
            order.completed_at = now

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

            payout = int(round(order.price_kop * (1 - float(order.commission_rate))))
            commission = order.price_kop - payout
            session.add_all(
                [
                    Transaction(
                        order_id=order.id,
                        user_id=order.executor_id,
                        type=TxType.payout,
                        amount_kop=payout,
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
                executor = (
                    await session.execute(
                        sa.select(User).where(User.id == order.executor_id)
                    )
                ).scalar_one()
                executor.completed_orders += 1
                await notify(
                    session,
                    order.executor_id,
                    "payout_pending",
                    f"Заказчик не ответил — авто-подтверждение. Выплата {payout // 100} ₽ по «{order.title}»",
                    push=True,
                )

        await session.commit()
        return len(orders)


async def expire_unpaid_orders() -> int:
    deadline_minutes = settings.payment_timeout_minutes
    border = datetime.now(timezone.utc).timestamp() - deadline_minutes * 60
    border_dt = datetime.fromtimestamp(border, tz=timezone.utc)

    async with SessionLocal() as session:
        orders = (
            await session.execute(
                sa.select(Order).where(
                    Order.status == OrderStatus.awaiting_payment,
                    Order.created_at <= border_dt,
                )
            )
        ).scalars().all()

        for order in orders:
            order.status = OrderStatus.cancelled
            await notify(
                session,
                order.customer_id,
                "order_expired",
                f"Заказ «{order.title}» отменён: оплата не поступила за {deadline_minutes} мин",
            )

        await session.commit()
        return len(orders)


async def scheduler_loop() -> None:
    while True:
        try:
            confirmed = await auto_confirm_orders()
            expired = await expire_unpaid_orders()
            if confirmed or expired:
                log.info("scheduler: auto-confirmed=%s expired=%s", confirmed, expired)
        except Exception:
            log.exception("scheduler tick failed")
        await asyncio.sleep(60)
