import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.db import get_session
from app.models import ExecutorProfile, ExecutorStatus, Notification, User, utcnow
from app.schemas import ExecutorProfileOut, UserOut, UserUpdate

router = APIRouter(prefix="/me", tags=["me"])


async def _with_executor_status(session, user: User) -> dict:
    profile_status = (
        await session.execute(
            sa.select(ExecutorProfile.status).where(ExecutorProfile.user_id == user.id)
        )
    ).scalar_one_or_none()
    data = UserOut.model_validate(user).model_dump()
    if user.is_admin:
        data["executor_status"] = "approved"
    elif profile_status is not None:
        data["executor_status"] = ExecutorStatus(profile_status).value
    return data


@router.get("", response_model=UserOut)
async def get_me(
    user: User = Depends(get_current_user),
    session=Depends(get_session),
) -> dict:
    return await _with_executor_status(session, user)


@router.patch("", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
) -> dict:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await session.commit()
    await session.refresh(user)
    return await _with_executor_status(session, user)


@router.post("/executor-apply", response_model=ExecutorProfileOut)
async def apply_executor(
    user: User = Depends(get_current_user),
    session=Depends(get_session),
) -> ExecutorProfile:
    if not user.full_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fill profile first")

    profile = (
        await session.execute(
            sa.select(ExecutorProfile).where(ExecutorProfile.user_id == user.id)
        )
    ).scalar_one_or_none()

    if profile is None:
        profile = ExecutorProfile(user_id=user.id)
        session.add(profile)

    if profile.status == ExecutorStatus.blocked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Executor access blocked")

    if profile.status == ExecutorStatus.rejected:
        profile.status = ExecutorStatus.pending

    await session.commit()
    await session.refresh(profile)
    return profile


@router.get("/notifications")
async def my_notifications(
    limit: int = 50,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    items = (
        await session.execute(
            sa.select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(min(limit, 100))
        )
    ).scalars().all()
    unread = (
        await session.execute(
            sa.select(sa.func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user.id,
                Notification.read_at.is_(None),
            )
        )
    ).scalar_one()
    return {
        "unread": unread,
        "items": [
            {
                "id": n.id,
                "type": n.type,
                "text": n.text,
                "payload": n.payload,
                "read": n.read_at is not None,
                "created_at": n.created_at.isoformat(),
            }
            for n in items
        ],
    }


@router.post("/notifications/read-all")
async def read_all_notifications(
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    await session.execute(
        sa.update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=utcnow())
    )
    await session.commit()
    return {"ok": True}


@router.get("/chat-unreads")
async def chat_unreads(
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    from app.models import Chat, ChatRead, Message, Order

    rows = (
        await session.execute(
            sa.select(Chat.order_id, Chat.id)
            .join(Order, Order.id == Chat.order_id)
            .where(sa.or_(Order.customer_id == user.id, Order.executor_id == user.id))
        )
    ).all()
    out: dict[str, int] = {}
    for order_id, chat_id in rows:
        read = (
            await session.execute(
                sa.select(ChatRead).where(
                    ChatRead.chat_id == chat_id, ChatRead.user_id == user.id
                )
            )
        ).scalar_one_or_none()
        last_read = read.last_read_message_id if read else 0
        cnt = (
            await session.execute(
                sa.select(sa.func.count())
                .select_from(Message)
                .where(
                    Message.chat_id == chat_id,
                    Message.id > last_read,
                    Message.sender_id != user.id,
                )
            )
        ).scalar_one()
        if cnt:
            out[str(order_id)] = cnt
    return out
