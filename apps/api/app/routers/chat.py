import json
import uuid

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from app.auth import get_current_user, validate_init_data
from app.config import get_settings
from app.db import SessionLocal, get_session
from app.models import Chat, ChatRead, Message, Order, User

settings = get_settings()
router = APIRouter(tags=["chat"])


class MessageBody(BaseModel):
    body: str = ""
    file_key: str | None = None


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


async def _notify_new_message(session, order_id: uuid.UUID, sender_id: uuid.UUID, preview: str) -> None:
    from app.services.notify import notify

    order = (
        await session.execute(sa.select(Order).where(Order.id == order_id))
    ).scalar_one_or_none()
    if order is None:
        return
    other = order.executor_id if order.customer_id == sender_id else order.customer_id
    await notify(
        session,
        other,
        "chat_message",
        f"💬 Новое сообщение по сделке: {preview}",
        {"order_id": str(order.id)},
        push=True,
    )


async def unread_count(session, chat: Chat, user: User) -> int:
    read = (
        await session.execute(
            sa.select(ChatRead).where(
                ChatRead.chat_id == chat.id, ChatRead.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    last_read = read.last_read_message_id if read else 0
    return (
        await session.execute(
            sa.select(sa.func.count())
            .select_from(Message)
            .where(
                Message.chat_id == chat.id,
                Message.id > last_read,
                Message.sender_id != user.id,
            )
        )
    ).scalar_one()


async def mark_read(session, chat: Chat, user: User) -> None:
    max_id = (
        await session.execute(
            sa.select(sa.func.coalesce(sa.func.max(Message.id), 0)).where(
                Message.chat_id == chat.id
            )
        )
    ).scalar_one()
    read = (
        await session.execute(
            sa.select(ChatRead).where(
                ChatRead.chat_id == chat.id, ChatRead.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if read is None:
        session.add(ChatRead(chat_id=chat.id, user_id=user.id, last_read_message_id=max_id))
    else:
        read.last_read_message_id = max(read.last_read_message_id, max_id)
    await session.commit()


async def system_message(session, order_id: uuid.UUID, text: str) -> None:
    chat = await _get_or_create_chat(session, order_id)
    msg = Message(chat_id=chat.id, sender_id=None, body=text[:4000])
    session.add(msg)
    await session.flush()
    await manager.broadcast(
        order_id,
        {
            "id": msg.id,
            "sender_id": None,
            "sender_name": "Система",
            "body": msg.body,
            "created_at": msg.created_at.isoformat(),
            "mine": False,
        },
    )


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
            "file_key": m.file_key,
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
    if not payload.body.strip() and not payload.file_key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty message")

    chat = await _get_or_create_chat(session, order_id)
    msg = Message(
        chat_id=chat.id,
        sender_id=user.id,
        body=payload.body.strip()[:4000],
        file_key=payload.file_key,
    )
    session.add(msg)
    await session.commit()

    result = {
        "id": msg.id,
        "sender_id": str(user.id),
        "sender_name": user.full_name,
        "body": msg.body,
        "file_key": msg.file_key,
        "created_at": msg.created_at.isoformat(),
        "mine": True,
    }
    await _notify_new_message(
        session, order_id, user.id, (msg.body or "вложение")[:80]
    )
    await session.commit()
    await manager.broadcast(order_id, {**result, "mine": False})
    return result


@router.get("/orders/{order_id}/chat/state")
async def chat_state(
    order_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    order = await _participant_order(session, order_id, user)
    chat = (
        await session.execute(sa.select(Chat).where(Chat.order_id == order.id))
    ).scalar_one_or_none()
    unread = await unread_count(session, chat, user) if chat else 0
    return {"unread": unread}


@router.post("/orders/{order_id}/chat/read")
async def chat_mark_read(
    order_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session=Depends(get_session),
):
    order = await _participant_order(session, order_id, user)
    chat = await _get_or_create_chat(session, order.id)
    await mark_read(session, chat, user)
    return {"ok": True}


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
            if data.get("type") == "typing":
                await manager.broadcast(
                    order_id,
                    {"type": "typing", "from": str(user.id), "name": user.full_name},
                )
                continue
            body = str(data.get("body", ""))[:4000].strip()
            file_key = data.get("file_key")
            if not body and not file_key:
                continue
            async with SessionLocal() as session:
                chat = await _get_or_create_chat(session, order_id)
                msg = Message(chat_id=chat.id, sender_id=user.id, body=body, file_key=file_key)
                session.add(msg)
                await session.flush()
                await _notify_new_message(session, order_id, user.id, (body or "вложение")[:80])
                await session.commit()
                await manager.broadcast(
                    order_id,
                    {
                        "id": msg.id,
                        "sender_id": str(user.id),
                        "sender_name": user.full_name,
                        "body": msg.body,
                        "file_key": msg.file_key,
                        "created_at": msg.created_at.isoformat(),
                        "mine": False,
                    },
                )
    except WebSocketDisconnect:
        manager.disconnect(order_id, ws)
