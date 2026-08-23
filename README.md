# StudEx — биржа заказов для студентов

Telegram Mini App (React) + бот (aiogram 3) + API (FastAPI) + PostgreSQL.

## Быстрый старт

### 1. Инфраструктура

```bash
docker compose up -d
```

Поднимет PostgreSQL (`studex/studex@localhost:5432/studex`) и Redis.

Без Docker можно работать на SQLite — так и настроено по умолчанию в `.env.example`.

### 2. API

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

При старте создаются таблицы и сидируются предметы БИ (1–4 курс).
Swagger: http://localhost:8000/docs

### 3. Бот

```bash
cd apps/bot
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../../.env.example .env  # вписать BOT_TOKEN от @BotFather, WEBAPP_URL
python -m bot.main
```

`/start` в боте выдаёт кнопку «Открыть StudEx» (Mini App).

Для дева без HTTPS: `ngrok http 5173` → адрес в `WEBAPP_URL` и в BotFather (/newapp).

### 4. Миниапп

```bash
cd apps/web
npm install
npm run dev
```

http://localhost:5173 — открывается в браузере с dev-пользователем,
внутри Telegram авторизуется через `initData`.

## Аутентификация

Заголовок `Authorization: tma <initData>` проверяется HMAC-подписью бота.
В dev-режиме (без `BOT_TOKEN`) работает `Authorization: dev <telegram_id>`.

## Структура

```
apps/
  api/   FastAPI + SQLAlchemy 2 (async), леджер транзакций, статусы заказа
  bot/   aiogram 3: /start, кнопка миниаппа, deep links (?startapp=order_<id>)
  web/   Vite + React 18 + TS + Tailwind 4 + Motion, TabBar, страницы сделки
```

## Жизненный цикл заказа

```
awaiting_payment → paid → in_work → delivered → completed | disputed
                                     └── авто-подтверждение через 72ч ──┘
```

Деньги учитываются в копейках, каждое движение пишется в `transactions` (леджер).
Приём платежей (ЮKassa) и выплаты подключаются в спринте 3; сейчас статусы
и леджер работают в «сухом» режиме.

## Roadmap

- [x] Скелет монорепо, модели БД, auth, каталог предметов, CRUD заказов
- [x] Чат сделки (REST + WebSocket), квиз-допуск исполнителей
- [x] Арбитраж споров (3 исхода), админ-статистика, баны
- [x] Подписки на предметы + пуш-уведомления в бот (poller /internal/pushes)
- [x] Таймеры: авто-подтверждение 72ч, отмена неоплаченных через 30 мин
- [x] Инбокс событий в миниаппе (колокольчик с непрочитанными), подписка на предмет из ленты
- [x] WS-чат на фронте + админ-панель (/admin): статистика, арбитраж, баны
- [ ] ЮKassa: инвойсы, эскроу-платежи, выплаты (эндпоинт /orders/{id}/pay — симуляция)
- [ ] Alembic-миграции после стабилизации схемы

## Смоук-тесты

```bash
cd apps/api && PYTHONPATH=. .venv/bin/python scripts/smoke.py    # полный цикл сделки
PYTHONPATH=. .venv/bin/python scripts/smoke2.py                  # квиз, чат, споры, пуши
```
