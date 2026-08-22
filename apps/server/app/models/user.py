"""User 模型 - 权威来源: docs/architecture/04-data-model.md"""

import uuid
from sqlalchemy import Column, String, DateTime, func
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

    # 本地登录
    password_hash = Column(String(128), nullable=False)

    # 全局角色: super_admin / admin / member
    role = Column(String(20), nullable=False, default="member")

    # 账号状态: active / suspended / banned
    status = Column(String(20), nullable=False, default="active")

    # 登录时间
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<User {self.username}>"
