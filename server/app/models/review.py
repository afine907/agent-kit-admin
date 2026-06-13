"""Review 模型 - 权威来源: wiki/04-data-model.md"""

import uuid
from sqlalchemy import Column, String, Text, SmallInteger, DateTime, func, UniqueConstraint, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Review(Base):
    """评价模型"""

    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    package_id = Column(UUID(as_uuid=True), ForeignKey("packages.id", ondelete="CASCADE"), nullable=False)
    version_id = Column(UUID(as_uuid=True), ForeignKey("versions.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(SmallInteger, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("package_id", "user_id", name="uq_review_package_user"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="check_rating_range"),
    )

    def __repr__(self):
        return f"<Review {self.id}>"
