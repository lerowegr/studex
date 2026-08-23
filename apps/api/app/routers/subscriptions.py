import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.db import get_session
from app.models import Subject, Subscription, User

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("")
async def my_subscriptions(
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    rows = (
        await session.execute(
            sa.select(Subject)
            .join(Subscription, Subscription.subject_id == Subject.id)
            .where(Subscription.user_id == user.id)
        )
    ).scalars().all()
    return [{"id": s.id, "name": s.name, "emoji": s.emoji} for s in rows]


@router.post("/{subject_id}", status_code=201)
async def subscribe(
    subject_id: int,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    if (
        await session.execute(sa.select(Subject).where(Subject.id == subject_id))
    ).scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown subject")

    exists = (
        await session.execute(
            sa.select(Subscription).where(
                Subscription.user_id == user.id,
                Subscription.subject_id == subject_id,
            )
        )
    ).scalar_one_or_none()
    if exists is None:
        session.add(Subscription(user_id=user.id, subject_id=subject_id))
        await session.commit()
    return {"ok": True}


@router.delete("/{subject_id}")
async def unsubscribe(
    subject_id: int,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    await session.execute(
        sa.delete(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.subject_id == subject_id,
        )
    )
    await session.commit()
    return {"ok": True}
