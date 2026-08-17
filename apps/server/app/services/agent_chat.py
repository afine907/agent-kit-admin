"""Skill 测试对话 Agent 服务（OpenAI 兼容流式接口）

流程:
1. 校验包存在且为 skill 类型（PackageService 处理可见性）
2. 获取 Skill content（内联或 MinIO）
3. 构造 system prompt（中文包装 + Skill content）
4. 调用 OpenAI 兼容接口流式生成，逐 token yield
"""

import json
import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.errors import AppError, ErrorCodes
from app.services.package import PackageService
from app.services.version import VersionService

logger = logging.getLogger(__name__)
settings = get_settings()

# 注入到 system prompt 的 Skill 上下文模板
_SYSTEM_PROMPT_TEMPLATE = """你正在测试以下 Skill 的效果。

# Skill 名称
{package_name}

# Skill 描述
{description}

# Skill 内容
{content}

请扮演该 Skill 的执行者，根据上面的 Skill 内容回答用户的问题。如果用户的问题超出 Skill 的能力范围，请如实说明。
"""


class AgentChatService:
    """Skill 测试对话服务"""

    def __init__(self, db: AsyncSession, llm_client: httpx.AsyncClient | None = None):
        self.db = db
        # 允许测试注入 mock 客户端；None 时惰性创建
        self.llm_client = llm_client

    async def _get_llm_client(self) -> httpx.AsyncClient:
        if self.llm_client is not None:
            return self.llm_client
        return httpx.AsyncClient(timeout=120)

    def _build_system_prompt(self, package_name: str, description: str, content: str) -> str:
        return _SYSTEM_PROMPT_TEMPLATE.format(
            package_name=package_name,
            description=description or "-",
            content=content,
        )

    async def stream_chat(
        self,
        scope: str,
        name: str,
        version: str | None,
        messages: list[dict],
    ):
        """生成 SSE 流式响应

        Yields:
            dict: {"type": "meta", "model": str} 或 {"type": "delta", "text": str}
        """
        # 1. 校验包存在 + 可见性，且为 skill 类型
        package_service = PackageService(self.db)
        package = await package_service.get_package(scope, name)
        if package.type != "skill":
            raise AppError(
                code=ErrorCodes.INVALID_PARAM,
                message="该包不是 Skill 类型，无法进行对话测试",
                status_code=400,
            )

        # 2. 解析版本并获取 Skill content
        version_service = VersionService(self.db)
        if version:
            ver = await version_service.get_version(str(package.id), version)
            if not ver:
                raise AppError(
                    code=ErrorCodes.VERSION_NOT_FOUND,
                    message=f"版本 {version} 不存在",
                    status_code=404,
                )
        else:
            ver = await version_service.get_latest_version(str(package.id))
            if not ver:
                raise AppError(
                    code=ErrorCodes.VERSION_NOT_FOUND,
                    message="该包暂无已发布版本",
                    status_code=404,
                )
            version = ver.version

        content, _source = await version_service.get_skill_content(str(package.id), version)

        # 3. 构造 system prompt + 对话历史
        system_prompt = self._build_system_prompt(package.name, package.description or "", content)
        llm_messages = [{"role": "system", "content": system_prompt}]
        llm_messages.extend(messages)

        # 4. 校验 LLM 配置并流式调用
        if not settings.OPENAI_API_KEY:
            raise AppError(
                code=ErrorCodes.LLM_NOT_CONFIGURED,
                message="LLM 服务未配置，请管理员设置 OPENAI_API_KEY",
                status_code=503,
            )

        client = await self._get_llm_client()
        payload = {
            "model": settings.OPENAI_MODEL,
            "messages": llm_messages,
            "stream": True,
            "max_tokens": settings.OPENAI_MAX_TOKENS,
        }

        yield {"type": "meta", "model": settings.OPENAI_MODEL}

        try:
            async with client.stream(
                "POST",
                f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    logger.warning(
                        "LLM upstream error: status=%s body=%s",
                        response.status_code,
                        body[:500],
                    )
                    raise AppError(
                        code=ErrorCodes.LLM_UPSTREAM_ERROR,
                        message=f"LLM 服务返回错误 (HTTP {response.status_code})",
                        status_code=502,
                    )

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[len("data:") :].strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    text = delta.get("content")
                    if text:
                        yield {"type": "delta", "text": text}
        except AppError:
            raise
        except Exception as e:
            logger.exception("LLM streaming failed")
            raise AppError(
                code=ErrorCodes.LLM_UPSTREAM_ERROR,
                message=f"LLM 服务调用失败: {str(e)}",
                status_code=502,
            )
        finally:
            # 只在自建客户端时关闭（注入的 mock 由测试管理生命周期）
            if self.llm_client is None:
                await client.aclose()
