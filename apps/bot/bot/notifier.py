import asyncio
import logging

import aiohttp

from bot.config import settings

log = logging.getLogger("studex.notifier")


async def push_loop(bot) -> None:
    url = f"{settings.api_url}/api/internal/pushes"
    headers = {"X-Service-Key": settings.service_key}
    async with aiohttp.ClientSession() as http:
        while True:
            try:
                async with http.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        for item in await resp.json():
                            tg_id = item.get("telegram_id")
                            text = item.get("text")
                            if tg_id and text:
                                try:
                                    await bot.send_message(int(tg_id), text)
                                except Exception as e:
                                    log.warning("send to %s failed: %s", tg_id, e)
                    else:
                        log.warning("pushes endpoint %s", resp.status)
            except Exception as e:
                log.warning("poll failed: %s", e)
            await asyncio.sleep(5)
