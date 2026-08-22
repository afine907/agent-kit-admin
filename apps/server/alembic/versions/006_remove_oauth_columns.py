"""Remove OAuth columns from users table

Revision ID: 006
Revises: 005
Create Date: 2026-08-21 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove OAuth index
    op.drop_index("idx_users_oauth", table_name="users")
    # Remove OAuth unique constraint
    op.drop_constraint("uq_user_oauth", "users", type_="unique")
    # Remove OAuth columns
    op.drop_column("users", "oauth_provider")
    op.drop_column("users", "oauth_id")


def downgrade() -> None:
    # Re-add OAuth columns
    op.add_column("users", sa.Column("oauth_id", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("oauth_provider", sa.String(20), nullable=False, server_default="local"))
    op.create_unique_constraint("uq_user_oauth", "users", ["oauth_provider", "oauth_id"])
    op.create_index("idx_users_oauth", "users", ["oauth_provider", "oauth_id"])
