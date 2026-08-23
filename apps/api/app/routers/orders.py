import uuid
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_session
from app.models import (
    Dispute,
    DisputeStatus,
    ExecutorProfile,
    ExecutorStatus,
    FileKind,
    Order,
    OrderFile,
    OrderStatus,
    Review,
    Subject,
    Subscription,
    Transaction,
    TxStatus,
    TxType,
    Upload,
    User,
)
from app.schemas import (
    OrderCardOut,
    OrderCreate,
    OrderDetailOut,
    ReviewCreate,
    ReviewOut,
)

settings = get_settings()
router = APIRouter(prefix="/orders", tags=["orders"])

OPEN_STATUSES = (OrderStatus.paid,)


def _kop(rub: float) -> int:
    return int(round(rub * 100))


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _load_order(session, order_id) -> Order | None:
    return (
        await session.execute(sa.select(Order).where(Order.id == order_id))
    ).scalar_one_or_none()


async def _get_subject(session, subject_id: int) -> Subject:
    subject = (
        await session.execute(sa.select(Subject).where(Subject.id == subject_id))
    ).scalar_one_or_none()
    if subject is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown subject")
    return subject


async def _files_map(session, order_ids: list[uuid.UUID]) -> dict:
    if not order_ids:
        return {}
    rows = await session.execute(
        sa.select(OrderFile).where(OrderFile.order_id.in_(order_ids))
    )
    out: dict[uuid.UUID, list[OrderFile]] = {}
    for f in rows.scalars():
        out.setdefault(f.order_id, []).append(f)
    return out


def _card(order: Order, subject: Subject) -> OrderCardOut:
    return OrderCardOut(
        id=order.id,
        title=order.title,
        category=order.category,
        price_kop=order.price_kop,
        deadline=order.deadline,
        status=order.status,
        created_at=order.created_at,
        subject=subject,
    )


async def _detail(
    session, order: Order, user: User
) -> OrderDetailOut:
    row = await session.execute(
        sa.select(Subject).where(Subject.id == order.subject_id)
    )
    subject = row.scalar_one()
    files = (await _files_map(session, [order.id])).get(order.id, [])
    return OrderDetailOut(
        id=order.id,
        title=order.title,
        category=order.category,
        price_kop=order.price_kop,
        deadline=order.deadline,
        status=order.status,
        created_at=order.created_at,
        subject=subject,
        customer_is_me=order.customer_id == user.id,
        executor_is_me=order.executor_id == user.id,
        executor_id=order.executor_id,
        description=order.description,
        commission_rate=float(order.commission_rate),
        auto_confirm_at=order.auto_confirm_at,
        taken_at=order.taken_at,
        delivered_at=order.delivered_at,
        completed_at=order.completed_at,
        files=files,
    )


async def _require_order_access(
    session, order: Order, user: User, allow_public_feed: bool = False
) -> None:
    is_participant = user.id in (order.customer_id, order.executor_id)
    if is_participant or user.is_admin:
        return
    if allow_public_feed and order.status in OPEN_STATUSES:
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a participant")


@router.post("", response_model=OrderDetailOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: OrderCreate,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    if not user.full_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fill profile first")

    subject = await _get_subject(session, body.subject_id)
    if body.deadline <= _now():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Deadline must be in future")

    order = Order(
        customer_id=user.id,
        subject_id=subject.id,
        category=body.category,
        title=body.title,
        description=body.description,
        price_kop=_kop(body.price_rub),
        commission_rate=settings.commission_rate,
        deadline=body.deadline,
    )
    session.add(order)
    await session.flush()

    if body.task_file_key:
        upload = (
            await session.execute(sa.select(Upload).where(Upload.key == body.task_file_key))
        ).scalar_one_or_none()
        session.add(
            OrderFile(
                order_id=order.id,
                kind=FileKind.task,
                s3_key=body.task_file_key,
                file_name=upload.file_name if upload else "task",
                size_bytes=upload.size_bytes if upload else 0,
            )
        )

    session.add(
        Transaction(
            order_id=order.id,
            user_id=user.id,
            type=TxType.escrow_hold,
            amount_kop=-order.price_kop,
            status=TxStatus.pending,
        )
    )
    await session.commit()
    return await _detail(session, order, user)


@router.get("/feed", response_model=list[OrderCardOut])
async def feed_orders(
    subject_id: int | None = None,
    category: str | None = None,
    max_price_rub: float | None = None,
    limit: int = 50,
    offset: int = 0,
    _user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    stmt = (
        sa.select(Order, Subject)
        .join(Subject, Subject.id == Order.subject_id)
        .where(Order.status.in_(OPEN_STATUSES))
        .order_by(Order.created_at.desc())
        .limit(min(limit, 100))
        .offset(offset)
    )
    if subject_id is not None:
        stmt = stmt.where(Order.subject_id == subject_id)
    if category:
        stmt = stmt.where(Order.category == category)
    if max_price_rub is not None:
        stmt = stmt.where(Order.price_kop <= _kop(max_price_rub))

    rows = (await session.execute(stmt)).all()
    return [_card(order, subject) for order, subject in rows]


@router.get("/mine", response_model=list[OrderCardOut])
async def my_orders(
    role: str = "customer",
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    column = Order.customer_id if role == "customer" else Order.executor_id
    stmt = (
        sa.select(Order, Subject)
        .join(Subject, Subject.id == Order.subject_id)
        .where(column == user.id)
        .order_by(Order.updated_at.desc())
        .limit(100)
    )
    rows = (await session.execute(stmt)).all()
    return [_card(order, subject) for order, subject in rows]


@router.get("/{order_id}", response_model=OrderDetailOut)
async def get_order_detail(
    order_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    order = await _load_order(session, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    await _require_order_access(session, order, user, allow_public_feed=True)
    return await _detail(session, order, user)


@router.post("/{order_id}/pay", response_model=OrderDetailOut)
async def pay_order(
    order_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    order = await _load_order(session, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.customer_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only customer can pay")
    if order.status != OrderStatus.awaiting_payment:
        raise HTTPException(status.HTTP_409_CONFLICT, "Order is not awaiting payment")

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

    order.status = OrderStatus.paid
    await _fanout_new_order(session, order)
    await session.commit()
    return await _detail(session, order, user)


async def _fanout_new_order(session, order: Order) -> None:
    from app.services.notify import notify

    subject = (
        await session.execute(sa.select(Subject).where(Subject.id == order.subject_id))
    ).scalar_one()
    subscribers = (
        await session.execute(
            sa.select(Subscription.user_id).where(
                Subscription.subject_id == order.subject_id,
                Subscription.user_id != order.customer_id,
            )
        )
    ).scalars().all()
    text = f"🔥 Новый заказ: {subject.name} — {order.title} ({order.price_kop // 100} ₽)"
    for uid in subscribers:
        await notify(session, uid, "new_order", text, {"order_id": str(order.id)}, push=True)
    await notify(
        session,
        order.customer_id,
        "order_paid",
        f"Заказ «{order.title}» открыт, деньги в эскроу",
        {"order_id": str(order.id)},
    )


@router.post("/{order_id}/take", response_model=OrderDetailOut)
async def take_order(
    order_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    profile = (
        await session.execute(
            sa.select(ExecutorProfile).where(ExecutorProfile.user_id == user.id)
        )
    ).scalar_one_or_none()
    if profile is None or profile.status != ExecutorStatus.approved:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Executor access required")

    order = await _load_order(session, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.customer_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot take your own order")
    if order.status != OrderStatus.paid:
        raise HTTPException(status.HTTP_409_CONFLICT, "Order is not open for taking")

    order.executor_id = user.id
    order.status = OrderStatus.in_work
    order.taken_at = _now()
    from app.services.notify import notify

    await notify(
        session,
        order.customer_id,
        "order_taken",
        f"Исполнитель найден: {user.full_name}. Заказ «{order.title}» в работе",
        {"order_id": str(order.id)},
    )
    await session.commit()
    return await _detail(session, order, user)


@router.post("/{order_id}/deliver", response_model=OrderDetailOut)
async def deliver_order(
    order_id: uuid.UUID,
    result_file_key: str | None = None,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    order = await _load_order(session, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.executor_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only assigned executor can deliver")
    if order.status != OrderStatus.in_work:
        raise HTTPException(status.HTTP_409_CONFLICT, "Order is not in work")

    if result_file_key:
        upload = (
            await session.execute(sa.select(Upload).where(Upload.key == result_file_key))
        ).scalar_one_or_none()
        session.add(
            OrderFile(
                order_id=order.id,
                kind=FileKind.result,
                s3_key=result_file_key,
                file_name=upload.file_name if upload else "result",
                size_bytes=upload.size_bytes if upload else 0,
            )
        )

    now = _now()
    order.status = OrderStatus.delivered
    order.delivered_at = now
    order.auto_confirm_at = now + timedelta(hours=settings.auto_confirm_hours)

    from app.services.notify import notify

    await notify(
        session,
        order.customer_id,
        "order_delivered",
        f"Работа «{order.title}» сдана! Проверь и подтверди. Авто-подтверждение через {settings.auto_confirm_hours} ч",
        {"order_id": str(order.id)},
    )
    await session.commit()
    return await _detail(session, order, user)


@router.post("/{order_id}/complete", response_model=OrderDetailOut)
async def complete_order(
    order_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    order = await _load_order(session, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.customer_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only customer can confirm")
    if order.status != OrderStatus.delivered:
        raise HTTPException(status.HTTP_409_CONFLICT, "Order is not delivered")

    order.status = OrderStatus.completed
    order.completed_at = _now()

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
            await session.execute(sa.select(User).where(User.id == order.executor_id))
        ).scalar_one()
        executor.completed_orders += 1

    from app.services.notify import notify
    from app.services.notify import notify_admins

    payout_rub = payout // 100
    await notify(
        session,
        order.executor_id,
        "payout_pending",
        f"Заказ «{order.title}» завершён. Выплата {payout_rub} ₽ в обработке",
        {"order_id": str(order.id)},
        push=True,
    )
    await notify(
        session,
        order.customer_id,
        "order_completed",
        f"Спасибо! Сделка «{order.title}» закрыта. Оцени исполнителя",
        {"order_id": str(order.id)},
    )
    await notify_admins(
        session,
        "payout_manual",
        f"Требуется выплата {payout_rub} ₽ по заказу {str(order.id)[:8]}",
        {"order_id": str(order.id)},
    )

    await session.commit()
    return await _detail(session, order, user)


@router.post("/{order_id}/dispute", response_model=OrderDetailOut)
async def open_dispute(
    order_id: uuid.UUID,
    reason: str = "Не указана",
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    order = await _load_order(session, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    await _require_order_access(session, order, user)
    if order.status not in (OrderStatus.in_work, OrderStatus.delivered):
        raise HTTPException(status.HTTP_409_CONFLICT, "Dispute unavailable at this stage")

    existing = (
        await session.execute(sa.select(Dispute).where(Dispute.order_id == order.id))
    ).scalar_one_or_none()
    if existing is None:
        session.add(Dispute(order_id=order.id, opened_by=user.id, reason=reason[:2000]))
    order.status = OrderStatus.disputed

    from app.services.notify import notify, notify_admins

    other = order.executor_id if user.id == order.customer_id else order.customer_id
    await notify(
        session,
        other,
        "dispute_opened",
        f"По сделке «{order.title}» открыт спор. Деньги заморожены до решения арбитража",
        {"order_id": str(order.id)},
        push=True,
    )
    await notify_admins(
        session,
        "dispute_admin",
        f"Открыт спор по заказу {str(order.id)[:8]}: {reason[:100]}",
        {"order_id": str(order.id), "dispute_order": str(order.id)},
    )
    await session.commit()
    return await _detail(session, order, user)


@router.post("/{order_id}/cancel", response_model=OrderDetailOut)
async def cancel_order(
    order_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    order = await _load_order(session, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.customer_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only customer can cancel")
    if order.status != OrderStatus.awaiting_payment:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Paid orders go through dispute"
        )

    hold = (
        await session.execute(
            sa.select(Transaction).where(
                Transaction.order_id == order.id,
                Transaction.type == TxType.escrow_hold,
                Transaction.status == TxStatus.pending,
            )
        )
    ).scalar_one_or_none()

    order.status = OrderStatus.cancelled
    if hold is not None:
        hold.status = TxStatus.failed
    await session.commit()
    return await _detail(session, order, user)


@router.post("/{order_id}/review", response_model=ReviewOut, status_code=201)
async def create_review(
    order_id: uuid.UUID,
    body: ReviewCreate,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    order = await _load_order(session, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.status != OrderStatus.completed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Reviews after completion only")
    if user.id not in (order.customer_id, order.executor_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a participant")

    target_id = (
        order.executor_id if order.customer_id == user.id else order.customer_id
    )

    exists = (
        await session.execute(
            sa.select(Review).where(
                Review.order_id == order.id, Review.author_id == user.id
            )
        )
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already reviewed")

    review = Review(
        order_id=order.id,
        author_id=user.id,
        target_id=target_id,
        rating=body.rating,
        comment=body.comment,
    )
    session.add(review)

    target = (
        await session.execute(sa.select(User).where(User.id == target_id))
    ).scalar_one()
    total = target.rating_num * target.rating_count + body.rating
    target.rating_count += 1
    target.rating_num = round(total / target.rating_count, 2)

    await session.commit()
    await session.refresh(review)
    return review


@router.get("/{order_id}/dispute-status", response_model=dict)
async def dispute_status(
    order_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    order = await _load_order(session, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    await _require_order_access(session, order, user)
    dispute = (
        await session.execute(sa.select(Dispute).where(Dispute.order_id == order.id))
    ).scalar_one_or_none()
    if dispute is None:
        return {"exists": False}
    return {
        "exists": True,
        "status": DisputeStatus(dispute.status).value,
        "opened_by": str(dispute.opened_by),
        "reason": dispute.reason,
        "resolution_note": dispute.resolution_note,
    }
