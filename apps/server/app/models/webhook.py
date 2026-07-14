"""Webhook 模型"""

import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, func
from app.database import Base, CompatJSONB, CompatUUID


class Webhook(Base):
    """Webhook 配置"""

    __tablename__ = "webhooks"

    id = Column(CompatUUID, primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    team_id = Column(CompatUUID, ForeignKey("teams.id"), nullable=False, index=True)
    url = Column(Text, nullable=False)
    secret = Column(String(255), nullable=False)  # HMAC-SHA256 密钥
    events = Column(CompatJSONB, nullable=False, default=list)  # ["package.published", "version.yanked"]
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Webhook {self.id} team={self.team_id}>"
