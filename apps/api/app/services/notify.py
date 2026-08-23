import uuid

import sqlalchemy as sa

from app.db import SessionLocal
from app.models import Notification, User, utcnow


async def notify(
    session,
    user_id: uuid.UUID | None,
    type_: str,
    text: str,
    payload: dict | None = None,
    push: bool = False,
) -> None:
    if user_id is None:
        return
    tg_id = None
    if push:
        tg_id = (
            await session.execute(sa.select(User.telegram_id).where(User.id == user_id))
        ).scalar_one_or_none()
    session.add(
        Notification(
            user_id=user_id,
            type=type_,
            text=text,
            payload={**(payload or {}), "telegram_id": tg_id, "push": push},
        )
    )


async def notify_admins(session, type_: str, text: str, payload: dict | None = None) -> None:
    admins = (
        await session.execute(sa.select(User).where(User.is_admin.is_(True)))
    ).scalars().all()
    for admin in admins:
        await notify(session, admin.id, type_, text, payload, push=True)


async def push_batch(session) -> list[dict]:
    rows = (
        await session.execute(
            sa.select(Notification)
            .where(Notification.sent_at.is_(None))
            .where(Notification.type.notin_(["chat_message"]))
            .order_by(Notification.created_at)
            .limit(50)
        )
    ).scalars().all()
    out = []
    for n in rows:
        out.append(
            {
                "id": n.id,
                "telegram_id": n.payload.get("telegram_id"),
                "text": n.text,
                "type": n.type,
            }
        )
        n.sent_at = utcnow()
    await session.commit()
    return out
