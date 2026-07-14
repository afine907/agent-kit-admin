"""已安装包记录模型

追踪用户本地安装的包及其版本，用于：
  - 展示「有更新」标记
  - 团队包安装状态
  - 用户安装历史
"""

import uuid
from sqlalchemy import Column, String, DateTime, func, UniqueConstraint
from app.database import CompatUUID as UUID, Base


class InstalledPackage(Base):
    """用户已安装的包记录"""

    __tablename__ = "installed_packages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), nullable=False)
    package_id = Column(UUID(as_uuid=True), nullable=False)
    version_installed = Column(String(50), nullable=False)
    installed_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("user_id", "package_id", name="uq_installed_user_package"),)

    def __repr__(self):
        return f"<InstalledPackage user={self.user_id} pkg={self.package_id} v={self.version_installed}>"
