"""User 模型 - 权威来源: docs/architecture/04-data-model.md"""

import uuid
from sqlalchemy import Column, String, DateTime, func, UniqueConstraint
from app.database import CompatUUID as UUID
from app.database import Base


class User(Base):
    """用户模型"""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True)
    display_name = Column(String(100), nullable=True)
    avatar_url = Column(String, nullable=True)
    oauth_provider = Column(String(20), nullable=False)  # wechat_work / feishu / dingtalk
    oauth_id = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("oauth_provider", "oauth_id", name="uq_user_oauth"),)

    def __repr__(self):
        return f"<User {self.username}>"
