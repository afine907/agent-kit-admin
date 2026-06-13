"""应用配置 - 使用 Pydantic Settings 管理环境变量"""

from pydantic_settings import BaseSettings
from pydantic import model_validator
from functools import lru_cache


# 默认值常量 - 用于检测是否配置了真实值
_DEFAULT_JWT_SECRET = "agent-kit-jwt-secret-key-change-in-production-2024"
_DEFAULT_DB_PASSWORD = "agentkit_dev_2024"
_DEFAULT_MINIO_PASSWORD = "minioadmin_dev_2024"


class Settings(BaseSettings):
    """应用配置"""

    # 应用
    APP_NAME: str = "Agent Kit Admin"
    APP_VERSION: str = "0.1.0"
    APP_BASE_URL: str = "http://localhost:8000"  # 应用基础 URL，用于 OAuth 回调等
    DEBUG: bool = False

    # 数据库 - 支持 PostgreSQL 和 SQLite
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "agentkit"
    DB_PASSWORD: str = "agentkit_dev_2024"
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
    MINIO_ROOT_PASSWORD: str = "minioadmin_dev_2024"
    MINIO_BUCKET: str = "packages"
    MINIO_SECURE: bool = False

    # JWT
    JWT_SECRET: str = "agent-kit-jwt-secret-key-change-in-production-2024"
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

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """生产环境安全检查 - 验证敏感配置是否使用了默认值"""
        if not self.DEBUG:
            # 生产环境检查
            errors = []

            if self.JWT_SECRET == _DEFAULT_JWT_SECRET:
                errors.append("JWT_SECRET 使用了默认值，生产环境必须更改")

            if self.DB_PASSWORD == _DEFAULT_DB_PASSWORD:
                errors.append("DB_PASSWORD 使用了默认值，生产环境必须更改")

            if self.MINIO_ROOT_PASSWORD == _DEFAULT_MINIO_PASSWORD:
                errors.append("MINIO_ROOT_PASSWORD 使用了默认值，生产环境必须更改")

            if errors:
                raise ValueError("生产环境安全检查失败:\n" + "\n".join(f"  - {e}" for e in errors))

        return self


@lru_cache
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()
