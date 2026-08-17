import pytest
from unittest.mock import AsyncMock, MagicMock

from app.inspect.checks.content import check_content


@pytest.mark.asyncio
async def test_content_tarball_missing():
    """tarball 不存在时返回 fail"""
    mock_storage = AsyncMock()
    mock_storage.object_exists.return_value = False

    mock_package = MagicMock()
    mock_package.id = "pkg-123"
    mock_version = MagicMock()
    mock_version.version = "1.0.0"

    result = await check_content(mock_package, mock_version, mock_storage)
    assert result.status == "fail"
    assert "tarball 不存在" in result.detail["error"]


@pytest.mark.asyncio
async def test_content_empty_content():
    """content 为空时返回 fail"""
    mock_storage = AsyncMock()
    mock_storage.object_exists.return_value = True

    mock_package = MagicMock()
    mock_package.id = "pkg-123"
    mock_version = MagicMock()
    mock_version.version = "1.0.0"
    mock_version.manifest = {"skill": {"content": "   "}}

    result = await check_content(mock_package, mock_version, mock_storage)
    assert result.status == "fail"
    assert "content 为空" in result.detail["error"]


@pytest.mark.asyncio
async def test_content_valid():
    """正常 content 返回 pass"""
    mock_storage = AsyncMock()
    mock_storage.object_exists.return_value = True

    mock_package = MagicMock()
    mock_package.id = "pkg-123"
    mock_version = MagicMock()
    mock_version.version = "1.0.0"
    mock_version.manifest = {"skill": {"content": "This is a helpful skill for searching."}}

    result = await check_content(mock_package, mock_version, mock_storage)
    assert result.status == "pass"
    assert result.detail["content_length"] == len("This is a helpful skill for searching.")
