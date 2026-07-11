"""Batch operations API tests"""

import pytest
from app.models.user import User
from app.models.package import Package
from app.models.version import Version
from app.core.security import hash_password


@pytest.fixture
async def owner(db):
    user = User(
        username="batch_owner",
        email="batch_owner@example.com",
        display_name="Batch Owner",
        password_hash=hash_password("OwnerPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()
    return user


@pytest.fixture
async def other_user(db):
    user = User(
        username="batch_other",
        email="batch_other@example.com",
        display_name="Batch Other",
        password_hash=hash_password("OtherPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()
    return user


@pytest.fixture
async def packages(db, owner):
    """创建多个测试包"""
    pkgs = []
    for i in range(3):
        pkg = Package(
            name=f"batch-pkg-{i}",
            scope=f"@{owner.username}",
            full_name=f"@{owner.username}/batch-pkg-{i}",
            type="mcp",
            owner_id=owner.id,
            owner_type="user",
            visibility="public",
        )
        db.add(pkg)
        await db.flush()
        # 创建一个版本
        ver = Version(
            package_id=pkg.id,
            version=f"1.0.{i}",
            manifest={},
            tarball_hash=f"hash{i}",
            tarball_size=1000,
            tarball_path=f"packages/{pkg.id}/1.0.{i}.tgz",
        )
        db.add(ver)
        await db.flush()
        pkgs.append(pkg)
    return pkgs


def _auth_header(user: User) -> dict:
    from app.config import get_settings
    from jose import jwt
    from datetime import datetime, timedelta, timezone

    settings = get_settings()
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_batch_delete(client, packages, owner):
    """批量删除多个包"""
    pkg_names = [f"@{owner.username}/{p.name}" for p in packages[:2]]
    resp = await client.post(
        "/api/v1/packages/batch/delete",
        json={"packages": pkg_names},
        headers=_auth_header(owner),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["success"]) == 2
    assert len(data["failed"]) == 0


@pytest.mark.asyncio
async def test_batch_delete_partial_permission(client, packages, owner, other_user):
    """部分包无权限"""
    pkg_names = [
        f"@{owner.username}/{packages[0].name}",
        f"@{owner.username}/{packages[1].name}",
    ]
    resp = await client.post(
        "/api/v1/packages/batch/delete",
        json={"packages": pkg_names},
        headers=_auth_header(other_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["success"]) == 0
    assert len(data["failed"]) == 2
    assert all(f["error"] == "Permission denied" for f in data["failed"])


@pytest.mark.asyncio
async def test_batch_delete_not_found(client, owner):
    """包不存在"""
    resp = await client.post(
        "/api/v1/packages/batch/delete",
        json={"packages": [f"@{owner.username}/nonexistent"]},
        headers=_auth_header(owner),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["success"]) == 0
    assert len(data["failed"]) == 1
    assert data["failed"][0]["error"] == "Package not found"


@pytest.mark.asyncio
async def test_batch_delete_max_limit(client, packages, owner):
    """超过50个包返回400"""
    names = [f"@{owner.username}/pkg{i}" for i in range(51)]
    resp = await client.post(
        "/api/v1/packages/batch/delete",
        json={"packages": names},
        headers=_auth_header(owner),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_batch_deprecate(client, packages, owner):
    """批量废弃"""
    pkg_names = [f"@{owner.username}/{p.name}" for p in packages]
    resp = await client.post(
        "/api/v1/packages/batch/deprecate",
        json={"packages": pkg_names, "deprecated": True},
        headers=_auth_header(owner),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["success"]) == 3
    assert len(data["failed"]) == 0


@pytest.mark.asyncio
async def test_batch_deprecate_unflag(client, packages, owner):
    """批量取消废弃"""
    pkg_names = [f"@{owner.username}/{p.name}" for p in packages[:2]]
    resp = await client.post(
        "/api/v1/packages/batch/deprecate",
        json={"packages": pkg_names, "deprecated": False},
        headers=_auth_header(owner),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["success"]) == 2


@pytest.mark.asyncio
async def test_batch_deprecate_permission_denied(client, packages, other_user):
    """无权限废弃"""
    pkg_names = [f"@batch_owner/{packages[0].name}"]
    resp = await client.post(
        "/api/v1/packages/batch/deprecate",
        json={"packages": pkg_names, "deprecated": True},
        headers=_auth_header(other_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["failed"]) == 1
    assert data["failed"][0]["error"] == "Permission denied"
