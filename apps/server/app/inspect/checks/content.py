# apps/server/app/inspect/checks/content.py
"""B. 内容可访问检测 - MinIO tarball 存在 + content 可解析"""

from app.inspect.checks.types import CheckResult


async def check_content(package, version, storage) -> CheckResult:
    """验证 tarball 存在且 content 可解析"""
    tarball_key = f"packages/{package.id}/{version.version}.tar.gz"

    # 1. tarball 存在性
    exists = await storage.object_exists(tarball_key)
    if not exists:
        return CheckResult.fail({"error": f"tarball 不存在: {tarball_key}"})

    # 2. 从 manifest 获取 content
    manifest = version.manifest or {}
    skill = manifest.get("skill") or {}
    content = skill.get("content")

    if not content or not content.strip():
        return CheckResult.fail({"error": "skill content 为空"})

    return CheckResult.pass_({"source": "inline", "content_length": len(content)})
