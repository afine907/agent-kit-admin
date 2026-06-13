"""API Key 模型 - 权威来源: wiki/04-data-model.md"""

import uuid
from sqlalchemy import Column, String, DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class APIKey(Base):
    """API Key 模型 (CI/CD Token 认证)"""

    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)  # 描述名称
    key_hash = Column(String(128), unique=True, nullable=False)  # SHA256 哈希
    key_prefix = Column(String(10), nullable=False)  # 前缀用于展示
    permissions = Column(JSONB, default=["read", "write"])
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<APIKey {self.name}>"
