from datetime import datetime, timezone

import sqlalchemy as sa
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_session
from app.models import (
    ExecutorProfile,
    ExecutorStatus,
    ExecutorSubject,
    QuizAttempt,
    Subject,
    User,
)
from app.quiz_bank import check_answers, sample_questions

settings = get_settings()
router = APIRouter(prefix="/quiz", tags=["quiz"])


class QuizQuestions(BaseModel):
    questions: list[dict]


class QuizSubmit(BaseModel):
    answers: list[int] = Field(min_length=1)
    questions: list[dict]


@router.get("/{subject_id}", response_model=QuizQuestions)
async def get_quiz(
    subject_id: int,
    _user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    if (
        await session.execute(sa.select(Subject).where(Subject.id == subject_id))
    ).scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail="Unknown subject")
    return QuizQuestions(questions=sample_questions())


@router.post("/{subject_id}/submit")
async def submit_quiz(
    subject_id: int,
    body: QuizSubmit,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    score = check_answers(body.questions, body.answers)
    passed = score >= settings.quiz_pass_score

    attempt = QuizAttempt(
        user_id=user.id,
        subject_id=subject_id,
        score=score,
        passed=passed,
        payload={"questions": body.questions, "answers": body.answers},
    )
    session.add(attempt)

    if passed:
        profile = (
            await session.execute(
                sa.select(ExecutorProfile).where(ExecutorProfile.user_id == user.id)
            )
        ).scalar_one_or_none()
        if profile is None:
            profile = ExecutorProfile(user_id=user.id)
            session.add(profile)
        if profile.status is None or profile.status in (
            ExecutorStatus.pending,
            ExecutorStatus.rejected,
        ):
            profile.status = ExecutorStatus.approved
            profile.approved_at = datetime.now(timezone.utc)

        link = (
            await session.execute(
                sa.select(ExecutorSubject).where(
                    ExecutorSubject.executor_id == user.id,
                    ExecutorSubject.subject_id == subject_id,
                )
            )
        ).scalar_one_or_none()
        if link is None:
            session.add(ExecutorSubject(executor_id=user.id, subject_id=subject_id))

    await session.commit()
    return {"score": score, "total": len(body.questions), "passed": passed}
