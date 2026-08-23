import asyncio
import logging

from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)

from bot.config import settings
from bot.notifier import push_loop

logging.basicConfig(level=logging.INFO)

WELCOME = (
    "👋 Привет! Это <b>StudEx</b> — биржа учебных заказов.\n\n"
    "🛒 <b>Заказчик</b>: размести задание — лабу, курсовую или консультацию, "
    "и выбери исполнителя.\n"
    "💼 <b>Исполнитель</b>: пройди допуск по предметам и бери заказы.\n\n"
    "🔒 Деньги замораживаются в боте и уходят исполнителю только после "
    "твоего подтверждения.\n\n"
    "Жми кнопку ниже, чтобы начать 👇"
)


def webapp_keyboard(startapp: str | None = None) -> InlineKeyboardMarkup:
    url = settings.webapp_url
    if startapp:
        url = f"{url}/?startapp={startapp}"
    rows = [
        [InlineKeyboardButton(text="🚀 Открыть StudEx", web_app=WebAppInfo(url=url))]
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def cmd_start(message: types.Message, command: CommandObject | None = None):
    payload = command.args if command else None
    await message.answer(WELCOME, reply_markup=webapp_keyboard(payload))


async def cmd_menu(message: types.Message):
    await message.answer("Меню:", reply_markup=webapp_keyboard())


async def on_webapp_fallback(callback: types.CallbackQuery):
    await callback.answer()


def main() -> None:
    if not settings.token:
        raise SystemExit(
            "BOT_TOKEN is not set. Copy .env.example to apps/bot/.env and add token."
        )

    bot = Bot(token=settings.token)
    dp = Dispatcher()

    dp.message.register(cmd_start, CommandStart())
    dp.message.register(cmd_menu, F.text == "/menu")
    dp.callback_query.register(on_webapp_fallback)

    logging.info("Starting polling, webapp_url=%s", settings.webapp_url)

    async def run() -> None:
        notifier = asyncio.create_task(push_loop(bot))
        try:
            await dp.start_polling(bot)
        finally:
            notifier.cancel()

    asyncio.run(run())


if __name__ == "__main__":
    main()
