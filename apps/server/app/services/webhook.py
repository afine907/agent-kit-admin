"""Webhook 服务"""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhook import Webhook

logger = logging.getLogger(__name__)


class WebhookService:
    """Webhook 业务逻辑"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_webhook(
        self,
        team_id: UUID,
        url: str,
        secret: str,
        events: list[str],
    ) -> Webhook:
        """创建 webhook"""
        webhook = Webhook(
            team_id=team_id,
            url=url,
            secret=secret,
            events=events,
        )
        self.db.add(webhook)
        await self.db.flush()
        await self.db.refresh(webhook)
        return webhook

    async def list_webhooks(self, team_id: UUID) -> list[Webhook]:
        """列出团队的 webhooks"""
        result = await self.db.execute(
            select(Webhook).where(Webhook.team_id == team_id).order_by(Webhook.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_webhook(self, webhook_id: UUID, team_id: UUID) -> Webhook | None:
        """获取单个 webhook"""
        result = await self.db.execute(
            select(Webhook).where(
                Webhook.id == webhook_id,
                Webhook.team_id == team_id,
            )
        )
        return result.scalar_one_or_none()

    async def delete_webhook(self, webhook_id: UUID, team_id: UUID) -> bool:
        """删除 webhook"""
        webhook = await self.get_webhook(webhook_id, team_id)
        if not webhook:
            return False
        await self.db.delete(webhook)
        await self.db.flush()
        return True

    async def fire_webhooks(
        self,
        team_id: UUID,
        event: str,
        payload: dict,
        timeout: float = 5.0,
    ) -> None:
        """触发 webhooks（等待所有投递完成，最多 timeout 秒）"""
        import asyncio

        webhooks = await self.list_webhooks(team_id)
        active_webhooks = [w for w in webhooks if w.active and event in w.events]

        if not active_webhooks:
            return

        tasks = [
            asyncio.create_task(self._deliver_webhook(webhook, event, payload))
            for webhook in active_webhooks
        ]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _deliver_webhook(
        self,
        webhook: Webhook,
        event: str,
        payload: dict,
        max_retries: int = 3,
    ) -> None:
        """投递 webhook（带重试）"""
        body = {
            "event": event,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }
        body_bytes = json.dumps(body, ensure_ascii=False).encode()
        signature = hmac.new(
            webhook.secret.encode(),
            body_bytes,
            hashlib.sha256,
        ).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Signature": f"sha256={signature}",
            "X-Webhook-Event": event,
        }

        last_error = None
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    response = await client.post(
                        webhook.url,
                        content=body_bytes,
                        headers=headers,
                    )
                    if response.status_code < 300:
                        logger.info(f"Webhook {webhook.id} delivered successfully")
                        return
                    last_error = f"HTTP {response.status_code}"
            except Exception as e:
                last_error = str(e)

            # 指数退避
            if attempt < max_retries - 1:
                import asyncio

                await asyncio.sleep(2**attempt)

        logger.error(f"Webhook {webhook.id} failed after {max_retries} attempts: {last_error}")

    @staticmethod
    def verify_signature(secret: str, body: bytes, signature: str) -> bool:
        """验证 webhook 签名"""
        expected = hmac.new(
            secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(f"sha256={expected}", signature)
