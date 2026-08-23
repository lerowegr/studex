import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ExecutorStatusLiteral = Literal["pending", "approved", "rejected", "blocked"]
OrderCategoryLiteral = Literal[
    "lab", "coursework", "test_prep", "presentation", "online_consult", "urgent"
]
OrderStatusLiteral = Literal[
    "awaiting_payment",
    "paid",
    "in_work",
    "delivered",
    "completed",
    "disputed",
    "refunded",
    "cancelled",
]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    telegram_id: int
    username: str | None
    full_name: str | None
    course: int | None
    group_name: str | None
    program: str | None
    rating_num: float
    rating_count: int
    completed_orders: int
    is_admin: bool
    created_at: datetime
    executor_status: str = "none"


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=128)
    course: int | None = Field(default=None, ge=1, le=6)
    group_name: str | None = Field(default=None, max_length=32)
    program: str | None = Field(default=None, max_length=64)


class ExecutorProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: ExecutorStatusLiteral


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    course: int
    program: str
    emoji: str | None


class OrderFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: Literal["task", "result"]
    s3_key: str
    file_name: str
    size_bytes: int


class SubjectBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    course: int
    program: str
    emoji: str | None


class OrderCreate(BaseModel):
    subject_id: int
    category: OrderCategoryLiteral
    title: str = Field(min_length=4, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    price_rub: float = Field(gt=0, le=1_000_000)
    deadline: datetime
    task_file_key: str | None = None


class OrderCardOut(BaseModel):
    id: uuid.UUID
    title: str
    category: OrderCategoryLiteral
    price_kop: int
    deadline: datetime
    status: OrderStatusLiteral
    created_at: datetime
    subject: SubjectBrief


class OrderDetailOut(OrderCardOut):
    customer_is_me: bool = False
    executor_is_me: bool = False
    executor_id: uuid.UUID | None = None
    description: str | None
    commission_rate: float
    auto_confirm_at: datetime | None
    taken_at: datetime | None
    delivered_at: datetime | None
    completed_at: datetime | None
    files: list[OrderFileOut] = []


class TakeResultOut(OrderDetailOut):
    pass


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    author_id: uuid.UUID
    target_id: uuid.UUID
    rating: int
    comment: str | None


class UploadOut(BaseModel):
    key: str
    url: str
    file_name: str
    size_bytes: int


class OrderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=4, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    category: OrderCategoryLiteral | None = None
    price_rub: float | None = Field(default=None, gt=0, le=1_000_000)
    deadline: datetime | None = None
