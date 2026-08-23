import sqlalchemy as sa
from fastapi import APIRouter, Depends, Query

from app.auth import get_current_user
from app.db import get_session
from app.models import Subject, User
from app.schemas import SubjectOut

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("", response_model=list[SubjectOut])
async def list_subjects(
    course: int | None = Query(default=None, ge=1, le=6),
    program: str | None = None,
    q: str | None = Query(default=None, max_length=64),
    _user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    stmt = sa.select(Subject).order_by(Subject.course, Subject.name)
    if course is not None:
        stmt = stmt.where(Subject.course == course)
    if program:
        stmt = stmt.where(Subject.program == program)
    if q:
        stmt = stmt.where(Subject.name.ilike(f"%{q}%"))
    result = await session.execute(stmt)
    return list(result.scalars().all())
