import json
import uuid

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from app.auth import get_current_user, validate_init_data
from app.config import get_settings
from app.db import SessionLocal, get_session
from app.models import Chat, Message, Order, User

settings = get_settings()
router = APIRouter(tags=["chat"])


class MessageBody(BaseModel):
    body: str


async def _participant_order(session, order_id: uuid.UUID, user: User) -> Order:
    order = (
        await session.execute(sa.select(Order).where(Order.id == order_id))
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if user.id not in (order.customer_id, order.executor_id) and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a participant")
    return order


async def _get_or_create_chat(session, order_id: uuid.UUID) -> Chat:
    chat = (
        await session.execute(sa.select(Chat).where(Chat.order_id == order_id))
    ).scalar_one_or_none()
    if chat is None:
        chat = Chat(order_id=order_id)
        session.add(chat)
        await session.flush()
    return chat


class ConnectionManager:
    def __init__(self) -> None:
        self.rooms: dict[uuid.UUID, set[WebSocket]] = {}

    async def connect(self, room: uuid.UUID, ws: WebSocket) -> None:
        await ws.accept()
        self.rooms.setdefault(room, set()).add(ws)

    def disconnect(self, room: uuid.UUID, ws: WebSocket) -> None:
        self.rooms.get(room, set()).discard(ws)

    async def broadcast(self, room: uuid.UUID, payload: dict) -> None:
        for ws in list(self.rooms.get(room, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(room, ws)


manager = ConnectionManager()


@router.get("/orders/{order_id}/messages")
async def list_messages(
    order_id: uuid.UUID,
    limit: int = 200,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    await _participant_order(session, order_id, user)
    rows = (
        await session.execute(
            sa.select(Message, User)
            .join(Chat, Chat.id == Message.chat_id)
            .outerjoin(User, User.id == Message.sender_id)
            .where(Chat.order_id == order_id)
            .order_by(Message.id)
            .limit(min(limit, 500))
        )
    ).all()
    return [
        {
            "id": m.id,
            "sender_id": str(m.sender_id) if m.sender_id else None,
            "sender_name": u.full_name if u else "Система",
            "body": m.body,
            "created_at": m.created_at.isoformat(),
            "mine": bool(m.sender_id == user.id),
        }
        for m, u in rows
    ]


@router.post("/orders/{order_id}/messages", status_code=201)
async def send_message(
    order_id: uuid.UUID,
    payload: MessageBody,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    await _participant_order(session, order_id, user)
    if not payload.body.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty message")

    chat = await _get_or_create_chat(session, order_id)
    msg = Message(chat_id=chat.id, sender_id=user.id, body=payload.body.strip()[:4000])
    session.add(msg)
    await session.commit()

    result = {
        "id": msg.id,
        "sender_id": str(user.id),
        "sender_name": user.full_name,
        "body": msg.body,
        "created_at": msg.created_at.isoformat(),
        "mine": True,
    }
    await manager.broadcast(order_id, {**result, "mine": False})
    return result


@router.websocket("/ws/orders/{order_id}")
async def ws_chat(ws: WebSocket, order_id: uuid.UUID):
    token = ws.query_params.get("token", "")
    scheme, _, payload_token = token.partition(" ")

    async with SessionLocal() as session:
        user: User | None = None
        if settings.bot_token and scheme == "tma":
            data = validate_init_data(payload_token, settings.bot_token)
            if data and data.get("user"):
                tg_user = json.loads(data["user"])
                user = (
                    await session.execute(
                        sa.select(User).where(User.telegram_id == int(tg_user["id"]))
                    )
                ).scalar_one_or_none()
        elif not settings.bot_token and scheme == "dev":
            try:
                user = (
                    await session.execute(
                        sa.select(User).where(User.telegram_id == int(payload_token))
                    )
                ).scalar_one_or_none()
            except ValueError:
                user = None

        if user is None:
            await ws.close(code=4401)
            return
        try:
            await _participant_order(session, order_id, user)
        except HTTPException:
            await ws.close(code=4403)
            return

    await manager.connect(order_id, ws)
    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except ValueError:
                continue
            body = str(data.get("body", ""))[:4000].strip()
            if not body:
                continue
            async with SessionLocal() as session:
                chat = await _get_or_create_chat(session, order_id)
                msg = Message(chat_id=chat.id, sender_id=user.id, body=body)
                session.add(msg)
                await session.commit()
                await manager.broadcast(
                    order_id,
                    {
                        "id": msg.id,
                        "sender_id": str(user.id),
                        "sender_name": user.full_name,
                        "body": msg.body,
                        "created_at": msg.created_at.isoformat(),
                        "mine": False,
                    },
                )
    except WebSocketDisconnect:
        manager.disconnect(order_id, ws)
