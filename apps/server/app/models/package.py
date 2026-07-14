"""Package 模型 - 权威来源: docs/architecture/04-data-model.md"""

import uuid
from sqlalchemy import Column, String, Text, BigInteger, DateTime, func, UniqueConstraint
from app.database import CompatUUID as UUID
from app.database import Base, CompatJSONB


class Package(Base):
    """包模型"""

    __tablename__ = "packages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    name = Column(String(100), nullable=False)
    scope = Column(String(50), nullable=False)  # @team 或 @username
    full_name = Column(String(150), unique=True)  # generated always as scope||'/'||name
    type = Column(String(10), nullable=False)  # mcp / skill
    owner_id = Column(UUID(as_uuid=True), nullable=False)
    owner_type = Column(String(10), nullable=False, default="user")  # user / team
    description = Column(Text, nullable=True)
    license = Column(String(50), default="MIT")
    repository = Column(Text, nullable=True)
    homepage = Column(Text, nullable=True)
    visibility = Column(String(10), default="public")  # public / team / private
    downloads_count = Column(BigInteger, default=0)
    latest_version = Column(String(50), nullable=True)
    tags = Column(CompatJSONB, default=list)  # 标签数组 - 使用 list 工厂函数避免可变默认值问题
    category = Column(String(50), nullable=True, index=True)  # 包分类
    manifest_dependencies = Column(CompatJSONB, nullable=True)  # 解析后的依赖图
    admin_status = Column(String(20), default="active")  # active / suspended - 管理员下架状态
    admin_note = Column(Text, nullable=True)  # 管理员备注（如下架原因）
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # 软删除
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("scope", "name", name="uq_package_scope_name"),)

    def __repr__(self):
        return f"<Package {self.full_name}>"
