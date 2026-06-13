"""应用配置 - 使用 Pydantic Settings 管理环境变量"""

import logging
from pydantic_settings import BaseSettings
from pydantic import model_validator
from functools import lru_cache

logger = logging.getLogger(__name__)

# 开发环境默认值 - 仅在 ENVIRONMENT=development 时允许使用
_DEV_JWT_SECRET = "dev-only-jwt-secret-do-not-use-in-production"
_DEV_DB_PASSWORD = "agentkit_dev_2024"
_DEV_MINIO_PASSWORD = "minioadmin_dev_2024"


class Settings(BaseSettings):
    """应用配置"""

    # 应用
    APP_NAME: str = "Agent Kit Admin"
    APP_VERSION: str = "0.1.0"
    APP_BASE_URL: str = "http://localhost:8000"  # 应用基础 URL，用于 OAuth 回调等
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development / staging / production

    # 数据库 - 支持 PostgreSQL 和 SQLite
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "agentkit"
    DB_PASSWORD: str = _DEV_DB_PASSWORD
    DB_NAME: str = "agentkit"
    DATABASE_URL: str = ""  # 可选：直接指定数据库 URL（覆盖上述字段）

    @property
    def DATABASE_URL_RESOLVED(self) -> str:
        """获取实际使用的数据库 URL"""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        if self.DATABASE_URL:
            # SQLite 同步 URL
            if self.DATABASE_URL.startswith("sqlite"):
                return self.DATABASE_URL.replace("+aiosqlite", "")
            return self.DATABASE_URL.replace("+asyncpg", "")
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ROOT_USER: str = "minioadmin"
    MINIO_ROOT_PASSWORD: str = _DEV_MINIO_PASSWORD
    MINIO_BUCKET: str = "packages"
    MINIO_SECURE: bool = False

    # JWT
    JWT_SECRET: str = _DEV_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    # OAuth - 企业微信
    WECHAT_WORK_CORP_ID: str = ""
    WECHAT_WORK_SECRET: str = ""
    WECHAT_WORK_AGENT_ID: str = ""

    # OAuth - 飞书
    FEISHU_APP_ID: str = ""
    FEISHU_APP_SECRET: str = ""

    # OAuth - 钉钉
    DINGTALK_APP_KEY: str = ""
    DINGTALK_APP_SECRET: str = ""

    # 初始化管理员
    INIT_ADMIN_EMAIL: str = ""
    INIT_ADMIN_PASSWORD: str = ""

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """生产环境安全检查 - 验证敏感配置是否使用了默认值

        使用 ENVIRONMENT 而非 DEBUG 判断，避免调试模式绕过安全检查。
        production / staging 环境必须显式配置所有敏感值。
        """
        is_production = self.ENVIRONMENT in ("production", "staging")

        if is_production:
            errors = []

            if self.JWT_SECRET in (_DEV_JWT_SECRET, "agent-kit-jwt-secret-key-change-in-production-2024"):
                errors.append("JWT_SECRET 使用了默认值，生产环境必须通过环境变量设置")

            if self.DB_PASSWORD == _DEV_DB_PASSWORD:
                errors.append("DB_PASSWORD 使用了默认值，生产环境必须通过环境变量设置")

            if self.MINIO_ROOT_PASSWORD == _DEV_MINIO_PASSWORD:
                errors.append("MINIO_ROOT_PASSWORD 使用了默认值，生产环境必须通过环境变量设置")

            if errors:
                raise ValueError("生产环境安全检查失败:\n" + "\n".join(f"  - {e}" for e in errors))

        else:
            # 开发/测试环境 - 警告使用默认值
            warnings = []

            if self.JWT_SECRET == _DEV_JWT_SECRET:
                warnings.append("JWT_SECRET 使用开发默认值，仅限本地开发")

            if self.DB_PASSWORD == _DEV_DB_PASSWORD:
                warnings.append("DB_PASSWORD 使用开发默认值，仅限本地开发")

            if self.MINIO_ROOT_PASSWORD == _DEV_MINIO_PASSWORD:
                warnings.append("MINIO_ROOT_PASSWORD 使用开发默认值，仅限本地开发")

            if warnings:
                logger.warning(
                    "使用开发环境默认密钥:\n%s",
                    "\n".join(f"  - {w}" for w in warnings),
                )

        return self


@lru_cache
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()
