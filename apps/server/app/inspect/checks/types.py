"""检测维度共享类型"""

from dataclasses import dataclass


@dataclass
class CheckResult:
    """单个维度的检测结果"""

    status: str  # pass / fail / warn / error / skip
    detail: dict

    @classmethod
    def pass_(cls, detail: dict | None = None) -> "CheckResult":
        return cls(status="pass", detail=detail or {})

    @classmethod
    def fail(cls, detail: dict | None = None) -> "CheckResult":
        return cls(status="fail", detail=detail or {})

    @classmethod
    def warn(cls, detail: dict | None = None) -> "CheckResult":
        return cls(status="warn", detail=detail or {})

    @classmethod
    def error(cls, detail: dict | None = None) -> "CheckResult":
        return cls(status="error", detail=detail or {})

    @classmethod
    def skip(cls, detail: dict | None = None) -> "CheckResult":
        return cls(status="skip", detail=detail or {})
