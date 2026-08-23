import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.staticfiles import StaticFiles

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_session
from app.models import Upload, User
from app.schemas import UploadOut

settings = get_settings()
router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_SIZE = 20 * 1024 * 1024
ALLOWED_EXT = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".md", ".csv", ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".zip", ".rar", ".7z",
}


def uploads_dir():
    path = settings.data_dir / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


def mount_static(app):
    uploads_dir()
    app.mount("/files", StaticFiles(directory=str(uploads_dir())), name="files")


@router.post("", response_model=UploadOut, status_code=201)
async def upload_file(
    file: UploadFile,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    suffix = ""
    if file.filename and "." in file.filename:
        suffix = "." + file.filename.rsplit(".", 1)[1].lower()
    if suffix not in ALLOWED_EXT:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Extension {suffix or '(none)'} is not allowed",
        )

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Max 20 MB")

    key = f"{uuid.uuid4().hex}{suffix}"
    (uploads_dir() / key).write_bytes(data)

    record = Upload(
        key=key,
        owner_id=user.id,
        file_name=file.filename or key,
        size_bytes=len(data),
    )
    session.add(record)
    await session.commit()

    return UploadOut(
        key=key,
        url=f"/files/{key}",
        file_name=record.file_name,
        size_bytes=record.size_bytes,
    )
