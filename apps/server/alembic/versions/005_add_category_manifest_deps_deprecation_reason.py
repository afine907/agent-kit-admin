"""Add category, manifest_dependencies, deprecation_reason

Revision ID: 005
Revises: 004
Create Date: 2026-07-14 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # packages.category
    op.add_column("packages", sa.Column("category", sa.String(50), nullable=True, index=True))
    # packages.manifest_dependencies
    op.add_column("packages", sa.Column("manifest_dependencies", sa.JSON, nullable=True))
    # versions.deprecation_reason
    op.add_column("versions", sa.Column("deprecation_reason", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("versions", "deprecation_reason")
    op.drop_column("packages", "manifest_dependencies")
    op.drop_column("packages", "category")
