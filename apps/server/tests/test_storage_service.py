"""StorageService 单元测试"""

import hashlib
from unittest.mock import MagicMock, patch

import pytest

from app.services.storage import get_storage_service, StorageService


class TestStorageServiceSingleton:
    """单例模式测试"""

    def test_get_storage_service_returns_same_instance(self):
        """get_storage_service 应返回相同实例"""
        import app.services.storage as storage_module

        storage_module._storage_instance = None
        svc1 = get_storage_service()
        svc2 = get_storage_service()
        assert svc1 is svc2


class TestStorageServiceInit:
    """__init__ 测试"""

    def test_init_creates_boto3_client(self):
        """初始化应创建 boto3 S3 客户端"""
        with patch("app.services.storage.boto3") as mock_boto3:
            mock_client = MagicMock()
            mock_boto3.client.return_value = mock_client

            service = StorageService()

            mock_boto3.client.assert_called_once()
            call_args = mock_boto3.client.call_args
            assert call_args[0][0] == "s3"
            assert "endpoint_url" in call_args[1]
            assert "aws_access_key_id" in call_args[1]
            assert service.client is mock_client


class TestUploadTarball:
    """upload_tarball 测试"""

    @pytest.mark.asyncio
    async def test_upload_tarball_success(self):
        """上传成功返回对象路径和 SHA256"""
        with patch("app.services.storage.boto3") as mock_boto3:
            mock_client = MagicMock()
            # Mock put_object (sync, run in executor)
            mock_client.put_object = MagicMock()
            # Mock head_object for integrity check
            mock_client.head_object = MagicMock(return_value={"ContentLength": 14})
            mock_boto3.client.return_value = mock_client

            service = StorageService()
            data = b"test tarball ok"  # 15 bytes

            # Mock head_object to return exact byte count for integrity check
            mock_client.head_object = MagicMock(return_value={"ContentLength": len(data)})

            object_path, sha256 = await service.upload_tarball("@test", "pkg", "1.0.0", data)

            assert object_path == "packages/@test/pkg/1.0.0.tar.gz"
            assert sha256 == hashlib.sha256(data).hexdigest()

    @pytest.mark.asyncio
    async def test_upload_tarball_calls_put_object(self):
        """上传应调用 boto3 put_object"""
        with patch("app.services.storage.boto3") as mock_boto3:
            mock_client = MagicMock()
            mock_client.put_object = MagicMock()
            mock_client.head_object = MagicMock(return_value={"ContentLength": 4})
            mock_boto3.client.return_value = mock_client

            service = StorageService()
            await service.upload_tarball("@team", "mypackage", "2.0.0", b"data")

            mock_client.put_object.assert_called_once()
            call_kwargs = mock_client.put_object.call_args[1]
            assert call_kwargs["Bucket"] == "packages"
            assert call_kwargs["Key"] == "packages/@team/mypackage/2.0.0.tar.gz"

    @pytest.mark.asyncio
    async def test_upload_tarball_integrity_check_fail(self):
        """完整性检查失败应抛出 AppError"""
        with patch("app.services.storage.boto3") as mock_boto3:
            mock_client = MagicMock()
            mock_client.put_object = MagicMock()
            # 返回的长度与实际不匹配
            mock_client.head_object = MagicMock(return_value={"ContentLength": 999})
            mock_boto3.client.return_value = mock_client

            service = StorageService()

            with pytest.raises(Exception, match="integrity"):
                await service.upload_tarball("@test", "pkg", "1.0.0", b"small")


class TestGetPresignedUrl:
    """get_presigned_url 测试"""

    @pytest.mark.asyncio
    async def test_get_presigned_url_default_expiry(self):
        """默认 900 秒过期"""
        with patch("app.services.storage.boto3") as mock_boto3:
            mock_client = MagicMock()
            mock_client.generate_presigned_url = MagicMock(
                return_value="http://minio:9000/packages/key?signature=xxx"
            )
            mock_boto3.client.return_value = mock_client

            service = StorageService()
            url = await service.get_presigned_url("packages/@test/pkg/1.0.0.tar.gz")

            call_kwargs = mock_client.generate_presigned_url.call_args[1]
            assert call_kwargs["ExpiresIn"] == 900
            assert "http://" in url

    @pytest.mark.asyncio
    async def test_get_presigned_url_custom_expiry(self):
        """自定义过期时间"""
        with patch("app.services.storage.boto3") as mock_boto3:
            mock_client = MagicMock()
            mock_client.generate_presigned_url = MagicMock(return_value="http://example.com?signed")
            mock_boto3.client.return_value = mock_client

            service = StorageService()
            await service.get_presigned_url("packages/@test/pkg/1.0.0.tar.gz", expires=3600)

            call_kwargs = mock_client.generate_presigned_url.call_args[1]
            assert call_kwargs["ExpiresIn"] == 3600


class TestDeleteTarball:
    """delete_tarball 测试"""

    @pytest.mark.asyncio
    async def test_delete_tarball_calls_delete_object(self):
        """删除应调用 boto3 delete_object"""
        with patch("app.services.storage.boto3") as mock_boto3:
            mock_client = MagicMock()
            mock_client.delete_object = MagicMock()
            mock_boto3.client.return_value = mock_client

            service = StorageService()
            await service.delete_tarball("packages/@test/pkg/1.0.0.tar.gz")

            mock_client.delete_object.assert_called_once_with(
                Bucket="packages",
                Key="packages/@test/pkg/1.0.0.tar.gz",
            )


class TestGetTarballSize:
    """get_tarball_size 测试"""

    @pytest.mark.asyncio
    async def test_get_tarball_size_returns_content_length(self):
        """返回 head_object 的 ContentLength"""
        with patch("app.services.storage.boto3") as mock_boto3:
            mock_client = MagicMock()
            mock_client.head_object = MagicMock(return_value={"ContentLength": 4096})
            mock_boto3.client.return_value = mock_client

            service = StorageService()
            size = await service.get_tarball_size("packages/@test/pkg/1.0.0.tar.gz")

            assert size == 4096
            mock_client.head_object.assert_called_once_with(
                Bucket="packages",
                Key="packages/@test/pkg/1.0.0.tar.gz",
            )
