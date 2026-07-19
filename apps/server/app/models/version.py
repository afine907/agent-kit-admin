"""Version 模型 - 权威来源: docs/architecture/04-data-model.md"""

import uuid
from sqlalchemy import Column, String, Text, BigInteger, Boolean, DateTime, func, UniqueConstraint, ForeignKey
from app.database import CompatUUID as UUID
from app.database import Base, CompatJSONB


class Version(Base):
    """版本模型"""

    __tablename__ = "versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    package_id = Column(UUID(as_uuid=True), ForeignKey("packages.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(50), nullable=False)  # semver: 1.2.3
    manifest = Column(CompatJSONB, nullable=False)  # akit.json 的完整内容
    tarball_hash = Column(String(64), nullable=False)  # SHA256
    tarball_size = Column(BigInteger, nullable=False)
    tarball_path = Column(String(500), nullable=False)  # MinIO 路径
    dependencies = Column(CompatJSONB, default={})
    published_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    published_at = Column(DateTime(timezone=True), server_default=func.now())
    deprecated = Column(Boolean, default=False)
    deprecation_reason = Column(Text, nullable=True)  # 废弃原因
    yanked = Column(Boolean, default=False)
    tag = Column(String(50), nullable=True)  # latest / beta / alpha / rc

    __table_args__ = (UniqueConstraint("package_id", "version", name="uq_version_package_version"),)

    def __repr__(self):
        return f"<Version {self.version}>"
