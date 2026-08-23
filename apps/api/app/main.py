import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import Base, SessionLocal, engine
from app.routers import orders, subjects, uploads, users
from app.routers import admin, chat, internal, quiz, subscriptions
from app.routers.uploads import mount_static
from app.scheduler import scheduler_loop
from app.seed import seed

settings = get_settings()
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    if settings.seed_on_start:
        async with SessionLocal() as session:
            await seed(session)
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()


app = FastAPI(title="StudEx API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api")
app.include_router(subjects.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(quiz.router, prefix="/api")
app.include_router(subscriptions.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(internal.router, prefix="/api")
mount_static(app)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
