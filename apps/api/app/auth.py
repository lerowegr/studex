import hashlib
import hmac
import json
from typing import Any
from urllib.parse import parse_qsl

import sqlalchemy as sa
from fastapi import Depends, Header, HTTPException, status

from app.config import get_settings
from app.db import get_session
from app.models import User

settings = get_settings()


def validate_init_data(init_data: str, bot_token: str) -> dict[str, Any] | None:
    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=False))
    except ValueError:
        return None
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated, received_hash):
        return None
    return parsed


async def get_current_user(
    authorization: str | None = Header(default=None),
    session=Depends(get_session),
) -> User:
    if not authorization:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing authorization header")

    scheme, _, payload = authorization.partition(" ")

    if settings.bot_token and scheme == "tma":
        data = validate_init_data(payload, settings.bot_token)
        if data is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid initData signature")
        raw_user = data.get("user")
        if not raw_user:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "initData has no user")
        tg_user = json.loads(raw_user)
        telegram_id = int(tg_user["id"])
        username = tg_user.get("username")
    elif not settings.bot_token and scheme == "dev":
        try:
            telegram_id = int(payload)
        except ValueError as exc:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "dev token must be int") from exc
        username = None
    else:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unsupported auth scheme")

    user = (
        await session.execute(sa.select(User).where(User.telegram_id == telegram_id))
    ).scalar_one_or_none()
    if user is None:
        user = User(telegram_id=telegram_id, username=username)
        session.add(user)
        await session.commit()
        await session.refresh(user)

    if user.is_banned:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "User is banned")

    return user
