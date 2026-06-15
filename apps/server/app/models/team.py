"""Team 模型 - 权威来源: docs/architecture/04-data-model.md"""

import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, func, UniqueConstraint
from app.database import CompatUUID as UUID
from app.database import Base


class Team(Base):
    """团队模型"""

    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    name = Column(String(100), nullable=False)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    avatar_url = Column(Text, nullable=True)
    external_dept_id = Column(String(100), nullable=True)  # 企微/飞书/钉钉部门ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Team {self.slug}>"


class TeamMember(Base):
    """团队成员模型"""

    __tablename__ = "team_members"

    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role = Column(String(20), nullable=False, default="member")  # owner / admin / member
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_member"),)

    def __repr__(self):
        return f"<TeamMember team={self.team_id} user={self.user_id} role={self.role}>"
