import sqlalchemy as sa
from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import get_settings
from app.db import get_session
from app.services.notify import push_batch

settings = get_settings()
router = APIRouter(prefix="/internal", tags=["internal"])


def require_service_key(x_service_key: str | None = Header(default=None)) -> None:
    if not x_service_key or x_service_key != settings.service_key:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bad service key")


@router.get("/pushes")
async def pending_pushes(
    _key: None = Depends(require_service_key),
    session=Depends(get_session),
):
    return await push_batch(session)
