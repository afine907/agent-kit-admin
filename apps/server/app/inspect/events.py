"""事件触发 - 发布/版本更新时标记 needs_check"""

from sqlalchemy import update
from app.models.package import Package


async def mark_needs_check(db, package_id: str):
    """标记包需要检测"""
    await db.execute(
        update(Package).where(Package.id == package_id).values(needs_check=True)
    )
    await db.flush()


async def mark_needs_check_by_name(db, scope: str, name: str):
    """通过 scope/name 标记包需要检测"""
    await db.execute(
        update(Package)
        .where(Package.scope == scope, Package.name == name)
        .values(needs_check=True)
    )
    await db.flush()
