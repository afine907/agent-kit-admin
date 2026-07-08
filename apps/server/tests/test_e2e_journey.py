"""Server E2E 旅程测试 - 覆盖用户旅程完整 API 流程"""

import pytest
from httpx import AsyncClient
from app.models.user import User
from app.models.package import Package
from app.models.version import Version
from app.core.security import hash_password


# =============================================================================
# 阶段 3: 登录 / 注册
# =============================================================================


@pytest.mark.asyncio
async def test_register_local_user(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "TestPass123!",
            "display_name": "新用户",
        },
    )
    assert resp.status_code == 201, f"注册失败: {resp.status_code} {resp.text}"
    data = resp.json()
    assert "token" in data
    assert data["user"]["username"] == "newuser"


@pytest.mark.asyncio
async def test_login_local_user(client: AsyncClient, db):
    user = User(
        username="loginuser",
        email="login@example.com",
        display_name="登录用户",
        password_hash=hash_password("TestPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "TestPass123!"},
    )
    assert resp.status_code == 200, f"登录失败: {resp.status_code} {resp.text}"
    data = resp.json()
    assert "token" in data
    assert data["user"]["username"] == "loginuser"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, db):
    user = User(
        username="wrongpass",
        email="wrong@example.com",
        display_name="密码错误",
        password_hash=hash_password("CorrectPass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrong@example.com", "password": "WrongPassword!"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient, db):
    user = User(
        username="dupuser",
        email="dup1@example.com",
        display_name="重复用户",
        password_hash=hash_password("Pass123!"),
        oauth_provider="local",
        oauth_id=None,
        role="member",
        status="active",
    )
    db.add(user)
    await db.flush()

    resp = await client.post(
        "/api/v1/auth/register",
        json={"username": "dupuser", "email": "dup2@example.com", "password": "TestPass123!"},
    )
    assert resp.status_code == 201
    assert resp.json()["user"]["username"].startswith("dupuser")


# =============================================================================
# 阶段 4: 探索包（搜索/列表/详情）
# =============================================================================


@pytest.mark.asyncio
async def test_search_packages(client: AsyncClient, db, test_user: User):
    for name, desc in [("pg-mcp", "PostgreSQL MCP tool"), ("redis-mcp", "Redis MCP tool")]:
        db.add(
            Package(
                name=name,
                scope="@team",
                type="mcp",
                full_name=f"@team/{name}",
                description=desc,
                owner_id=test_user.id,
                visibility="public",
            )
        )
    await db.flush()

    resp = await client.get("/api/v1/packages?search=PostgreSQL")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert any(p["name"] == "pg-mcp" for p in data["data"])


@pytest.mark.asyncio
async def test_list_packages_pagination(client: AsyncClient, db, test_user: User):
    for i in range(12):
        db.add(
            Package(
                name=f"pkg-{i:02d}",
                scope="@test",
                type="mcp",
                full_name=f"@test/pkg-{i:02d}",
                description=f"Test {i}",
                owner_id=test_user.id,
                visibility="public",
            )
        )
    await db.flush()

    resp = await client.get("/api/v1/packages?page=1&per_page=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["pagination"]["total"] == 12
    assert len(data["data"]) == 5


@pytest.mark.asyncio
async def test_list_packages_filter_by_type(client: AsyncClient, db, test_user: User):
    db.add(
        Package(
            name="mcp-pkg",
            scope="@test",
            type="mcp",
            full_name="@test/mcp-pkg",
            description="MCP",
            owner_id=test_user.id,
            visibility="public",
        )
    )
    db.add(
        Package(
            name="skill-pkg",
            scope="@test",
            type="skill",
            full_name="@test/skill-pkg",
            description="Skill",
            owner_id=test_user.id,
            visibility="public",
        )
    )
    await db.flush()

    resp = await client.get("/api/v1/packages?type=mcp")
    assert resp.status_code == 200
    assert all(p["type"] == "mcp" for p in resp.json()["data"])


@pytest.mark.asyncio
async def test_get_package_detail(client: AsyncClient, db, test_user: User):
    pkg = Package(
        name="detail-test",
        scope="@test",
        type="mcp",
        full_name="@test/detail-test",
        description="Detail test",
        license="MIT",
        owner_id=test_user.id,
        visibility="public",
        downloads_count=100,
    )
    db.add(pkg)
    await db.flush()

    ver = Version(
        package_id=pkg.id,
        version="1.2.0",
        manifest={"name": "detail-test", "version": "1.2.0", "type": "mcp"},
        tarball_hash="sha256:abc123",
        tarball_size=2048,
        tarball_path="packages/@test/detail-test/1.2.0.tar.gz",
        tag="latest",
        published_by=test_user.id,
    )
    db.add(ver)
    pkg.latest_version = "1.2.0"
    await db.flush()

    resp = await client.get("/api/v1/packages/@test/detail-test")
    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == "@test/detail-test"
    assert data["latest_version"] == "1.2.0"
    assert data["downloads_count"] == 100


@pytest.mark.asyncio
async def test_get_package_versions(client: AsyncClient, db, test_user: User):
    pkg = Package(
        name="ver-test",
        scope="@test",
        type="mcp",
        full_name="@test/ver-test",
        description="Version test",
        owner_id=test_user.id,
        visibility="public",
    )
    db.add(pkg)
    await db.flush()

    for v in ["1.0.0", "1.1.0", "2.0.0"]:
        db.add(
            Version(
                package_id=pkg.id,
                version=v,
                manifest={"name": "ver-test", "version": v, "type": "mcp"},
                tarball_hash=f"sha256:v{v.replace('.', '')}",
                tarball_size=1024,
                tarball_path=f"packages/@test/ver-test/{v}.tar.gz",
                tag="latest" if v == "2.0.0" else None,
                published_by=test_user.id,
            )
        )
    pkg.latest_version = "2.0.0"
    await db.flush()

    resp = await client.get("/api/v1/packages/@test/ver-test/versions")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert len(data["data"]) == 3
    assert set(v["version"] for v in data["data"]) == {"1.0.0", "1.1.0", "2.0.0"}


@pytest.mark.asyncio
async def test_get_package_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/packages/@nonexist/not-exist")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_private_package_hidden(client: AsyncClient, db, test_user: User):
    db.add(
        Package(
            name="secret-pkg",
            scope="@test",
            type="mcp",
            full_name="@test/secret-pkg",
            description="Private",
            owner_id=test_user.id,
            visibility="private",
        )
    )
    await db.flush()

    resp = await client.get("/api/v1/packages?search=secret")
    assert resp.status_code == 200
    assert all(p["visibility"] == "public" for p in resp.json()["data"])


# =============================================================================
# 阶段 7: 进阶使用（list/update/uninstall）
# =============================================================================


@pytest.mark.asyncio
async def test_list_my_packages(client: AsyncClient, db, auth_headers, test_user: User):
    db.add(
        Package(
            name="my-pkg",
            scope="@test",
            type="mcp",
            full_name="@test/my-pkg",
            description="My pkg",
            owner_id=test_user.id,
            visibility="public",
        )
    )
    await db.flush()

    resp = await client.get("/api/v1/packages?owner=me", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) >= 1


@pytest.mark.asyncio
async def test_update_package(client: AsyncClient, db, auth_headers, test_user: User):
    pkg = Package(
        name="update-test",
        scope="@test",
        type="mcp",
        full_name="@test/update-test",
        description="Original",
        owner_id=test_user.id,
        visibility="public",
    )
    db.add(pkg)
    await db.flush()

    resp = await client.patch(
        "/api/v1/packages/@test/update-test",
        json={"description": "Updated"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated"


@pytest.mark.asyncio
async def test_delete_package(client: AsyncClient, db, auth_headers, test_user: User):
    pkg = Package(
        name="del-test",
        scope="@test",
        type="mcp",
        full_name="@test/del-test",
        description="To delete",
        owner_id=test_user.id,
        visibility="public",
    )
    db.add(pkg)
    await db.flush()

    resp = await client.delete("/api/v1/packages/@test/del-test", headers=auth_headers)
    assert resp.status_code == 204

    resp = await client.get("/api/v1/packages/@test/del-test")
    assert resp.status_code == 410


@pytest.mark.asyncio
async def test_cannot_delete_other_package(client: AsyncClient, db, auth_headers, test_user: User, another_user):
    pkg = Package(
        name="not-yours",
        scope="@test",
        type="mcp",
        full_name="@test/not-yours",
        description="Not yours",
        owner_id=another_user.id,
        visibility="public",
    )
    db.add(pkg)
    await db.flush()

    resp = await client.delete("/api/v1/packages/@test/not-yours", headers=auth_headers)
    assert resp.status_code == 403


# =============================================================================
# 阶段 8: 发布包
# =============================================================================


def _pub(client, scope, name, version, headers):
    from tests.helpers import create_test_tarball
    import json

    tarball_io = create_test_tarball(name=name, version=version)
    manifest = json.dumps(
        {
            "name": name,
            "version": version,
            "type": "mcp",
            "mcp": {"transport": "stdio", "command": "node", "args": ["index.js"]},
        }
    )
    resp = client.post(
        f"/api/v1/packages/{scope}/{name}/versions",
        data={"version": version, "manifest": manifest, "tag": "latest"},
        files={"tarball": (f"{name}-{version}.tar.gz", tarball_io.getvalue(), "application/gzip")},
        headers=headers,
    )
    return resp


@pytest.mark.asyncio
async def test_create_and_publish_package(client: AsyncClient, db, auth_headers, test_user: User):
    # 创建包
    resp = await client.post(
        "/api/v1/packages",
        json={"name": "pub-test", "scope": "@test", "type": "mcp", "description": "Publish test"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, f"创建包失败: {resp.status_code} {resp.text}"
    assert resp.json()["name"] == "pub-test"

    # 发布版本
    resp = await _pub(client, "@test", "pub-test", "1.0.0", auth_headers)
    assert resp.status_code == 201, f"发布版本失败: {resp.status_code} {resp.text}"
    assert resp.json()["version"] == "1.0.0"

    # 验证 latest_version
    resp = await client.get("/api/v1/packages/@test/pub-test")
    assert resp.json()["latest_version"] == "1.0.0"


@pytest.mark.asyncio
async def test_publish_multiple_versions(client: AsyncClient, db, auth_headers, test_user: User):
    resp = await client.post(
        "/api/v1/packages",
        json={"name": "multi-ver", "scope": "@test", "type": "mcp", "description": "Multi version"},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    for v in ["1.0.0", "1.1.0"]:
        resp = await _pub(client, "@test", "multi-ver", v, auth_headers)
        assert resp.status_code == 201, f"发布 {v} 失败: {resp.status_code} {resp.text}"

    resp = await client.get("/api/v1/packages/@test/multi-ver/versions")
    assert resp.status_code == 200
    versions = [v["version"] for v in resp.json()["data"]]
    assert "1.0.0" in versions and "1.1.0" in versions

    resp = await client.get("/api/v1/packages/@test/multi-ver")
    assert resp.json()["latest_version"] == "1.1.0"


@pytest.mark.asyncio
async def test_publish_duplicate_version_fails(client: AsyncClient, db, auth_headers, test_user: User):
    resp = await client.post(
        "/api/v1/packages",
        json={"name": "dup-ver", "scope": "@test", "type": "mcp", "description": "Dup version"},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    resp = await _pub(client, "@test", "dup-ver", "1.0.0", auth_headers)
    assert resp.status_code == 201

    resp = await _pub(client, "@test", "dup-ver", "1.0.0", auth_headers)
    assert resp.status_code == 409, f"重复版本应返回 409: {resp.status_code} {resp.text}"


@pytest.mark.asyncio
async def test_download_package_tarball(client: AsyncClient, db, auth_headers, test_user: User):
    resp = await client.post(
        "/api/v1/packages",
        json={"name": "dl-test", "scope": "@test", "type": "mcp", "description": "Download test"},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    resp = await _pub(client, "@test", "dl-test", "1.0.0", auth_headers)
    assert resp.status_code == 201

    resp = await client.get("/api/v1/packages/@test/dl-test/download", follow_redirects=False)
    assert resp.status_code == 302, f"下载应返回 302: {resp.status_code} {resp.text}"
    assert "location" in resp.headers


@pytest.mark.asyncio
async def test_download_specific_version(client: AsyncClient, db, auth_headers, test_user: User):
    resp = await client.post(
        "/api/v1/packages",
        json={"name": "ver-dl", "scope": "@test", "type": "mcp", "description": "Ver download"},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    for v in ["1.0.0", "2.0.0"]:
        resp = await _pub(client, "@test", "ver-dl", v, auth_headers)
        assert resp.status_code == 201

    resp = await client.get("/api/v1/packages/@test/ver-dl/versions/1.0.0/download", follow_redirects=False)
    assert resp.status_code == 302


@pytest.mark.asyncio
async def test_download_nonexistent_version(client: AsyncClient, db, auth_headers, test_user: User):
    resp = await client.post(
        "/api/v1/packages",
        json={"name": "no-ver", "scope": "@test", "type": "mcp", "description": "No ver"},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    resp = await client.get("/api/v1/packages/@test/no-ver/versions/99.99.99/download")
    assert resp.status_code == 404


# =============================================================================
# 完整旅程串联测试
# =============================================================================


@pytest.mark.asyncio
async def test_full_journey(client: AsyncClient, db, auth_headers, test_user: User):
    """完整旅程：注册 -> 创建包 -> 发布版本 -> 搜索 -> 详情 -> 下载"""

    # 1. 创建包
    resp = await client.post(
        "/api/v1/packages",
        json={
            "name": "full-journey",
            "scope": "@test",
            "type": "mcp",
            "description": "Full journey test",
            "license": "MIT",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    pkg_name = resp.json()["full_name"]  # @test/full-journey

    # 2. 发布版本
    resp = await _pub(client, "@test", "full-journey", "1.0.0", auth_headers)
    assert resp.status_code == 201

    # 3. 搜索包
    resp = await client.get("/api/v1/packages?search=full-journey")
    assert resp.status_code == 200
    assert any(p["full_name"] == pkg_name for p in resp.json()["data"])

    # 4. 按类型筛选
    resp = await client.get("/api/v1/packages?type=mcp")
    assert resp.status_code == 200
    assert all(p["type"] == "mcp" for p in resp.json()["data"])

    # 5. 获取包详情
    resp = await client.get(f"/api/v1/packages/{pkg_name}")
    assert resp.status_code == 200
    assert resp.json()["latest_version"] == "1.0.0"

    # 6. 获取版本列表
    resp = await client.get(f"/api/v1/packages/{pkg_name}/versions")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1

    # 7. 下载包
    resp = await client.get(f"/api/v1/packages/{pkg_name}/download", follow_redirects=False)
    assert resp.status_code == 302
    assert "location" in resp.headers


# =============================================================================
# 团队包管理旅程（v0.2.0 新功能）
# =============================================================================


@pytest.mark.asyncio
async def test_team_package_management_journey(
    client: AsyncClient, db, auth_headers, test_user: User, another_user: User, another_auth_headers
):
    """团队包管理旅程：创建团队 → 添加成员 → 发布团队包 → 安装 → 卸载 → 离开团队"""

    # 1. 创建团队
    resp = await client.post(
        "/api/v1/teams",
        json={"name": "E2E Team", "slug": "e2e-team", "description": "E2E test team"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    team_id = resp.json()["id"]

    # 2. 添加成员
    resp = await client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"user_id": str(another_user.id), "role": "member"},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    # 3. 创建团队包（通过团队端点发布）
    resp = await client.post(
        f"/api/v1/teams/{team_id}/packages",
        json={
            "name": "team-pkg",
            "type": "mcp",
            "description": "Team package for E2E",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, f"创建团队包失败: {resp.status_code} {resp.text}"
    package_id = resp.json()["id"]

    # 4. 发布版本到团队包
    resp = await client.post(
        f"/api/v1/teams/{team_id}/packages/{package_id}/versions",
        json={"version": "1.0.0", "manifest": {"name": "team-pkg", "version": "1.0.0", "type": "mcp"}},
        headers=auth_headers,
    )
    assert resp.status_code == 201, f"发布版本失败: {resp.status_code} {resp.text}"

    # 5. 成员安装团队包
    resp = await client.post(
        f"/api/v1/teams/{team_id}/packages/{package_id}/install",
        headers=another_auth_headers,
    )
    assert resp.status_code == 201

    # 6. 成员卸载团队包
    resp = await client.delete(
        f"/api/v1/teams/{team_id}/packages/{package_id}/install",
        headers=another_auth_headers,
    )
    assert resp.status_code == 204

    # 7. 成员离开团队
    resp = await client.post(
        f"/api/v1/teams/{team_id}/leave",
        headers=another_auth_headers,
    )
    assert resp.status_code == 204

    # 8. 验证 owner 不能离开
    resp = await client.post(
        f"/api/v1/teams/{team_id}/leave",
        headers=auth_headers,
    )
    assert resp.status_code == 400
