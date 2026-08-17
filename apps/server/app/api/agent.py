"""聊天 Agent API 路由 - SSE 流式对话

POST /api/v1/agent/chat (需认证):
    请求: {scope, name, version?, messages[]}
    响应: SSE 流 (data: {"meta": {"model": ...}} / {"delta": ...} / {"error": ...} / [DONE])
"""

import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user, UserType
from app.schemas.agent import ChatRequest
from app.services.agent_chat import AgentChatService
from app.errors import AppError, ErrorCodes

router = APIRouter(prefix="/agent", tags=["agent"])

# 对话历史最大条数（防止长上下文滥用）
MAX_HISTORY = 20


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    current_user: UserType = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """与 Skill 测试 Agent 对话（SSE 流式）"""
    # 截断历史到最近 MAX_HISTORY 条
    messages = [m.model_dump() for m in payload.messages[-MAX_HISTORY:]]

    async def event_stream():
        service = AgentChatService(db)
        try:
            async for item in service.stream_chat(
                scope=payload.scope,
                name=payload.name,
                version=payload.version,
                messages=messages,
            ):
                if item["type"] == "meta":
                    yield f"data: {json.dumps({'meta': {'model': item['model']}})}\n\n"
                elif item["type"] == "delta":
                    yield f"data: {json.dumps({'delta': item['text']})}\n\n"
        except AppError as e:
            yield f"data: {json.dumps({'error': {'code': e.error_code, 'message': e.error_message}})}\n\n"
        except Exception:
            yield f"data: {json.dumps({'error': {'code': ErrorCodes.UNKNOWN, 'message': '服务器内部错误'}})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
