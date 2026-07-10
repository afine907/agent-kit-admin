"""Webhook API 端点"""

import secrets
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.services.webhook import WebhookService
from app.services.team import TeamService
from app.errors import AppError, ErrorCodes

router = APIRouter()


class WebhookCreateRequest(BaseModel):
    """创建 webhook 请求"""

    url: str = Field(..., description="Webhook 回调 URL")
    events: list[str] = Field(..., description="订阅事件列表")


class WebhookResponse(BaseModel):
    """Webhook 响应"""

    id: UUID
    url: str
    events: list[str]
    active: bool
    created_at: str

    class Config:
        from_attributes = True


@router.post("/{team_id}/webhooks", response_model=WebhookResponse, status_code=201)
async def create_webhook(
    team_id: UUID,
    data: WebhookCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建 webhook（团队 owner/admin）"""
    team_service = TeamService(db)
    if not await team_service._is_team_admin(team_id, current_user.id):
        raise AppError(
            code=ErrorCodes.AUTH_FORBIDDEN,
            message="Only team owner or admin can create webhooks",
            status_code=403,
        )

    webhook_service = WebhookService(db)
    secret = secrets.token_hex(32)
    webhook = await webhook_service.create_webhook(
        team_id=team_id,
        url=data.url,
        secret=secret,
        events=data.events,
    )

    return WebhookResponse(
        id=webhook.id,
        url=webhook.url,
        events=webhook.events,
        active=webhook.active,
        created_at=str(webhook.created_at),
    )


@router.get("/{team_id}/webhooks", response_model=list[WebhookResponse])
async def list_webhooks(
    team_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出团队 webhooks"""
    team_service = TeamService(db)
    if not await team_service._is_team_member(team_id, current_user.id):
        raise AppError(
            code=ErrorCodes.AUTH_FORBIDDEN,
            message="Only team members can list webhooks",
            status_code=403,
        )

    webhook_service = WebhookService(db)
    webhooks = await webhook_service.list_webhooks(team_id)

    return [
        WebhookResponse(
            id=w.id,
            url=w.url,
            events=w.events,
            active=w.active,
            created_at=str(w.created_at),
        )
        for w in webhooks
    ]


@router.delete("/{team_id}/webhooks/{webhook_id}", status_code=204)
async def delete_webhook(
    team_id: UUID,
    webhook_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除 webhook（团队 owner/admin）"""
    team_service = TeamService(db)
    if not await team_service._is_team_admin(team_id, current_user.id):
        raise AppError(
            code=ErrorCodes.AUTH_FORBIDDEN,
            message="Only team owner or admin can delete webhooks",
            status_code=403,
        )

    webhook_service = WebhookService(db)
    deleted = await webhook_service.delete_webhook(webhook_id, team_id)
    if not deleted:
        raise AppError(
            code=ErrorCodes.NOT_FOUND,
            message="Webhook not found",
            status_code=404,
        )
