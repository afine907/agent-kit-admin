"""聊天 Agent 请求/响应模型"""

from typing import Literal
from pydantic import BaseModel, Field

ChatRole = Literal["user", "assistant", "system"]


class ChatMessage(BaseModel):
    """聊天消息"""

    role: ChatRole
    content: str = Field(..., max_length=20000, description="消息内容")


class ChatRequest(BaseModel):
    """聊天请求

    客户端只发送 {scope, name, version?, messages}，服务端加载 Skill content 构造 system prompt。
    model 字段忽略 — 服务端固定使用配置的模型，防止滥用成本。
    """

    scope: str = Field(..., description="包 scope，如 @test")
    name: str = Field(..., description="包名")
    version: str | None = Field(None, description="版本号，默认最新")
    messages: list[ChatMessage] = Field(..., min_length=1, description="对话历史")
    model: str | None = Field(None, description="模型名（忽略，服务端固定使用配置的 model）")
