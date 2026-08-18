import pytest
import uuid
from sqlalchemy import select
from app.models.package import Package
from app.inspect.events import mark_needs_check, mark_needs_check_by_name


async def _create_pkg(db, name="test", scope="test"):
    pkg = Package(
        id=str(uuid.uuid4()),
        name=name,
        scope=scope,
        full_name=f"@{scope}/{name}",
        type="skill",
        owner_id=str(uuid.uuid4()),
        owner_type="user",
    )
    db.add(pkg)
    await db.flush()
    return pkg


@pytest.mark.asyncio
async def test_mark_needs_check(db):
    pkg = await _create_pkg(db)
    assert pkg.needs_check is False

    await mark_needs_check(db, str(pkg.id))
    await db.flush()

    result = await db.execute(select(Package).where(Package.id == pkg.id))
    fetched = result.scalar_one_or_none()
    assert fetched.needs_check is True


@pytest.mark.asyncio
async def test_mark_needs_check_by_name(db):
    pkg = await _create_pkg(db, name="my-skill", scope="myteam")

    await mark_needs_check_by_name(db, "myteam", "my-skill")
    await db.flush()

    result = await db.execute(select(Package).where(Package.id == pkg.id))
    fetched = result.scalar_one_or_none()
    assert fetched.needs_check is True
