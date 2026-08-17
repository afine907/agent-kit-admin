"""A. 静态合规检测 - manifest schema 校验"""

import re

from app.inspect.checks.types import CheckResult

SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(-((0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$"
)

MAX_CONTENT_BYTES = 50000  # 50KB


def check_compliance(manifest: dict) -> CheckResult:
    """校验 manifest schema 合规性"""
    errors = []

    if not isinstance(manifest, dict):
        return CheckResult.fail({"error": "manifest 不是有效的 JSON 对象", "manifest_valid": False})

    # 必填字段
    for field in ["name", "version", "type"]:
        if field not in manifest:
            errors.append(f"缺少必填字段: {field}")

    # 类型必须是 skill
    if manifest.get("type") and manifest.get("type") != "skill":
        errors.append(f"类型必须是 skill，实际为: {manifest.get('type')}")

    # semver 校验
    version = manifest.get("version", "")
    if version and not SEMVER_PATTERN.match(version):
        errors.append("version 不符合 semver 规范")

    # content 大小限制
    content = manifest.get("skill", {}).get("content", "")
    if content and len(content) > MAX_CONTENT_BYTES:
        errors.append(f"skill content 超过 50KB: {len(content)} bytes")

    return CheckResult(
        status="fail" if errors else "pass",
        detail={"errors": errors, "manifest_valid": len(errors) == 0},
    )
