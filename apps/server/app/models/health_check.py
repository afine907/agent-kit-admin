"""AgentHealthCheck 模型 - Inspector Worker 健康检查结果"""

import uuid
from sqlalchemy import Column, String, Integer, DateTime, func, ForeignKey
from app.database import CompatUUID as UUID
from app.database import Base, CompatJSONB


class AgentHealthCheck(Base):
    """Skill 包健康检查结果"""

    __tablename__ = "agent_health_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    package_id = Column(UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False, index=True)
    version = Column(String(50), nullable=False)

    compliance_status = Column(String(10), nullable=False, default="pass")
    compliance_detail = Column(CompatJSONB, nullable=False, default=dict)
    content_status = Column(String(10), nullable=False, default="pass")
    content_detail = Column(CompatJSONB, nullable=False, default=dict)
    functional_status = Column(String(10), nullable=False, default="pass")
    functional_detail = Column(CompatJSONB, nullable=False, default=dict)
    freshness_status = Column(String(10), nullable=False, default="pass")
    freshness_detail = Column(CompatJSONB, nullable=False, default=dict)

    overall_status = Column(String(10), nullable=False, default="pending", index=True)
    trigger_type = Column(String(20), nullable=False, default="scheduled")
    llm_tokens_used = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self):
        return f"<AgentHealthCheck {self.package_id} {self.overall_status}>"
