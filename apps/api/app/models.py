import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


BigIntPK = BigInteger().with_variant(Integer(), "sqlite")


class ExecutorStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    blocked = "blocked"


class OrderCategory(str, enum.Enum):
    lab = "lab"
    coursework = "coursework"
    test_prep = "test_prep"
    presentation = "presentation"
    online_consult = "online_consult"
    urgent = "urgent"


class OrderStatus(str, enum.Enum):
    awaiting_payment = "awaiting_payment"
    paid = "paid"
    in_work = "in_work"
    delivered = "delivered"
    completed = "completed"
    disputed = "disputed"
    refunded = "refunded"
    cancelled = "cancelled"


class FileKind(str, enum.Enum):
    task = "task"
    result = "result"


class TxType(str, enum.Enum):
    escrow_hold = "escrow_hold"
    escrow_release = "escrow_release"
    commission = "commission"
    payout = "payout"
    refund = "refund"
    adjustment = "adjustment"


class TxStatus(str, enum.Enum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"


class DisputeStatus(str, enum.Enum):
    open = "open"
    resolved_executor = "resolved_executor"
    resolved_customer = "resolved_customer"
    resolved_split = "resolved_split"


class ComplaintStatus(str, enum.Enum):
    new = "new"
    reviewed = "reviewed"
    dismissed = "dismissed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(64))
    full_name: Mapped[str | None] = mapped_column(String(128))
    course: Mapped[int | None] = mapped_column(SmallInteger)
    group_name: Mapped[str | None] = mapped_column(String(32))
    program: Mapped[str | None] = mapped_column(String(64))
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    ban_reason: Mapped[str | None] = mapped_column(Text)
    rating_num: Mapped[float] = mapped_column(Float, default=0.0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_orders: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class ExecutorProfile(Base):
    __tablename__ = "executor_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    status: Mapped[ExecutorStatus] = mapped_column(
        Enum(ExecutorStatus, native_enum=False, length=32), default=ExecutorStatus.pending
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    course: Mapped[int] = mapped_column(SmallInteger)
    program: Mapped[str] = mapped_column(String(64))
    emoji: Mapped[str | None] = mapped_column(String(16))
    icon_url: Mapped[str | None] = mapped_column(String(512))

    __table_args__ = (UniqueConstraint("name", "course", "program", name="uq_subject"),)


class ExecutorSubject(Base):
    __tablename__ = "executor_subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    executor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))

    __table_args__ = (UniqueConstraint("executor_id", "subject_id", name="uq_executor_subject"),)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    score: Mapped[int] = mapped_column(SmallInteger)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), index=True
    )
    executor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), index=True
    )
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), index=True)
    category: Mapped[OrderCategory] = mapped_column(
        Enum(OrderCategory, native_enum=False, length=32)
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    price_kop: Mapped[int] = mapped_column(BigInteger)
    commission_rate: Mapped[float] = mapped_column(Numeric(4, 3), default=0.10)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, native_enum=False, length=32),
        default=OrderStatus.awaiting_payment,
        index=True,
    )
    auto_confirm_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_charge_id: Mapped[str | None] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    __table_args__ = (
        Index("ix_orders_status_subject", "status", "subject_id"),
        Index("ix_orders_deadline", "deadline"),
    )


class OrderFile(Base):
    __tablename__ = "order_files"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id"), index=True
    )
    kind: Mapped[FileKind] = mapped_column(Enum(FileKind, native_enum=False, length=16))
    s3_key: Mapped[str] = mapped_column(String(512))
    file_name: Mapped[str] = mapped_column(String(256))
    size_bytes: Mapped[int] = mapped_column(BigInteger)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("orders.id"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[TxType] = mapped_column(Enum(TxType, native_enum=False, length=32))
    amount_kop: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[TxStatus] = mapped_column(
        Enum(TxStatus, native_enum=False, length=16), default=TxStatus.pending
    )
    external_ref: Mapped[str | None] = mapped_column(String(256))
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Upload(Base):
    __tablename__ = "uploads"

    key: Mapped[str] = mapped_column(String(512), primary_key=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    file_name: Mapped[str] = mapped_column(String(256))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id"), unique=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ChatRead(Base):
    __tablename__ = "chat_reads"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chat_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chats.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    last_read_message_id: Mapped[int] = mapped_column(BigInteger, default=0)

    __table_args__ = (UniqueConstraint("chat_id", "user_id", name="uq_chat_read"),)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    chat_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chats.id"), index=True)
    sender_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str | None] = mapped_column(Text)
    file_key: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    target_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    rating: Mapped[int] = mapped_column(SmallInteger)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (UniqueConstraint("order_id", "author_id", name="uq_review"),)


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), unique=True)
    opened_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[DisputeStatus] = mapped_column(
        Enum(DisputeStatus, native_enum=False, length=32), default=DisputeStatus.open
    )
    resolution_note: Mapped[str | None] = mapped_column(Text)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    reporter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    target_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[ComplaintStatus] = mapped_column(
        Enum(ComplaintStatus, native_enum=False, length=16),
        default=ComplaintStatus.new,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))

    __table_args__ = (UniqueConstraint("user_id", "subject_id", name="uq_subscription"),)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(64))
    text: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
