# apps/server/app/inspect/checks/functional.py
"""C. LLM 功能实测 - 调 Test Agent 跑标准问答验证 Skill content 有效"""

import asyncio
import json
import logging

import httpx

from app.config import get_settings
from app.inspect.checks.types import CheckResult

MAX_RESPONSE_LENGTH = 10000  # 10KB 上限，防止内存溢出
LLM_TIMEOUT = 120  # LLM 调用总超时（秒）

logger = logging.getLogger(__name__)
settings = get_settings()

_FUNCTIONAL_TEST_PROMPT = "请用一句话说明这个 Skill 能做什么，并给出一个使用示例。"

_SYSTEM_PROMPT_TEMPLATE = """你正在测试以下 Skill 的效果。

# Skill 名称
{package_name}

# Skill 描述
{description}

# Skill 内容
{content}

请扮演该 Skill 的执行者，根据上面的 Skill 内容回答用户的问题。如果用户的问题超出 Skill 的能力范围，请如实说明。
"""


def _evaluate_response(response: str) -> bool:
    """判定 LLM 回复是否有效"""
    if len(response.strip()) < 20:
        return False
    if "超出" in response and "范围" in response:
        return False
    return True


async def _read_sse_stream(
    client: httpx.AsyncClient, payload: dict, settings
) -> str:
    """读取 SSE 流并拼接响应文本，带长度上限保护"""
    full_response = ""
    async with client.stream(
        "POST",
        f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions",
        json=payload,
        headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
    ) as response:
        if response.status_code != 200:
            raise RuntimeError(f"LLM HTTP {response.status_code}")

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
                full_response += text
                # 长度上限截断，防止内存溢出
                if len(full_response) >= MAX_RESPONSE_LENGTH:
                    logger.warning("LLM response truncated at %d chars", MAX_RESPONSE_LENGTH)
                    break

    return full_response


async def check_functional(package, version, db, llm_client: httpx.AsyncClient | None = None) -> CheckResult:
    """调 Test Agent 跑标准问答，验证 Skill content 有效"""
    if not settings.OPENAI_API_KEY:
        return CheckResult.skip({"reason": "OPENAI_API_KEY 未配置"})

    manifest = version.manifest or {}
    skill = manifest.get("skill") or {}
    content = skill.get("content", "")

    if not content:
        return CheckResult.fail({"error": "skill content 为空，无法进行功能测试"})

    system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(
        package_name=package.name,
        description=package.description or "-",
        content=content,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": _FUNCTIONAL_TEST_PROMPT},
    ]

    client = llm_client or httpx.AsyncClient(timeout=120)
    payload = {
        "model": settings.OPENAI_MODEL,
        "messages": messages,
        "stream": True,
        "max_tokens": 500,
    }

    full_response = ""
    try:
        full_response = await asyncio.wait_for(
            _read_sse_stream(client, payload, settings),
            timeout=LLM_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.warning("functional check LLM call timed out after %ds", LLM_TIMEOUT)
        return CheckResult.error({"error": f"LLM 调用超时 ({LLM_TIMEOUT}s)"})
    except Exception as e:
        logger.exception("functional check LLM call failed")
        return CheckResult.error({"error": str(e)})
    finally:
        if llm_client is None:
            try:
                await client.aclose()
            except Exception:
                pass

    passed = _evaluate_response(full_response)
    return CheckResult(
        status="pass" if passed else "fail",
        detail={
            "prompt": _FUNCTIONAL_TEST_PROMPT,
            "response": full_response[:500],
            "response_length": len(full_response),
        },
    )
