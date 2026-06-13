"""Add trigram indexes for package search optimization

Revision ID: 002
Revises: 001
Create Date: 2024-01-15 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 启用 pg_trgm 扩展（用于 ILIKE 模糊搜索）
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # 为包名添加三元组 GIN 索引
    # 加速 SELECT ... WHERE name ILIKE '%keyword%' 查询
    op.execute("""
        CREATE INDEX idx_packages_name_trgm
        ON packages USING gin (name gin_trgm_ops)
    """)

    # 为包描述添加三元组 GIN 索引（部分索引）
    # 加速 SELECT ... WHERE description ILIKE '%keyword%' 查询
    # 只为非空描述创建索引，节省存储空间和提升性能
    op.execute("""
        CREATE INDEX idx_packages_description_trgm
        ON packages USING gin (description gin_trgm_ops)
        WHERE description IS NOT NULL
    """)


def downgrade() -> None:
    # 删除三元组索引
    op.execute("DROP INDEX IF EXISTS idx_packages_description_trgm")
    op.execute("DROP INDEX IF EXISTS idx_packages_name_trgm")

    # 注意: 不删除 pg_trgm 扩展，因为其他迁移或其他项目可能依赖它
