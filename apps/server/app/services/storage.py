"""MinIO 存储服务"""

import asyncio
import hashlib
import logging
import tempfile
import threading
import boto3
from botocore.config import Config
from fastapi import UploadFile
from app.config import get_settings
from app.errors import AppError, ErrorCodes

logger = logging.getLogger(__name__)
settings = get_settings()

# 模块级单例 - 复用 boto3 客户端连接
_storage_instance: "StorageService | None" = None
_storage_lock = threading.Lock()


def get_storage_service() -> "StorageService":
    """获取 StorageService 单例

    单例模式避免每次请求都创建新的 boto3 客户端和 TCP 连接。
    使用 threading.Lock 保护线程安全。
    """
    global _storage_instance
    if _storage_instance is None:
        with _storage_lock:
            # Double-checked locking pattern
            if _storage_instance is None:
                _storage_instance = StorageService()
    return _storage_instance


class StorageService:
    """MinIO 存储服务"""

    def __init__(self):
        self.client = boto3.client(
            "s3",
            endpoint_url=f"{'https' if settings.MINIO_SECURE else 'http'}://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ROOT_USER,
            aws_secret_access_key=settings.MINIO_ROOT_PASSWORD,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
        self.bucket = settings.MINIO_BUCKET

    async def upload_tarball(self, scope: str, name: str, version: str, data: bytes) -> tuple[str, str]:
        """上传包文件到 MinIO，返回 (对象路径, SHA256) tuple"""
        object_path = f"packages/{scope}/{name}/{version}.tar.gz"

        try:
            # 计算 SHA256
            sha256 = hashlib.sha256(data).hexdigest()

            # 使用线程池执行同步操作
            loop = asyncio.get_running_loop()

            # 上传文件
            await loop.run_in_executor(
                None,
                lambda: self.client.put_object(
                    Bucket=self.bucket,
                    Key=object_path,
                    Body=data,
                    ContentType="application/gzip",
                    Metadata={"sha256": sha256},
                ),
            )

            # 验证文件完整性
            head = await loop.run_in_executor(
                None,
                lambda: self.client.head_object(Bucket=self.bucket, Key=object_path),
            )
            if head["ContentLength"] != len(data):
                raise AppError(
                    code=ErrorCodes.STORAGE_INTEGRITY_ERROR,
                    message="File integrity verification failed",
                    status_code=500,
                )

            return object_path, sha256
        except AppError:
            raise
        except Exception as e:
            raise AppError(
                code=ErrorCodes.STORAGE_UPLOAD_FAILED,
                message=f"File upload failed: {str(e)}",
                status_code=500,
            )

    async def upload_tarball_streaming(
        self, scope: str, name: str, version: str, file: UploadFile
    ) -> tuple[str, str, int]:
        """流式上传包文件到 MinIO

        使用 SpooledTemporaryFile 实现流式处理:
        - 小文件 (<10MB) 在内存中处理
        - 大文件 (>10MB) 临时落盘，减少内存压力

        Returns:
            (对象路径, SHA256, 文件大小)
        """
        object_path = f"packages/{scope}/{name}/{version}.tar.gz"
        sha256_hash = hashlib.sha256()
        total_size = 0
        MAX_TARBALL_SIZE = 50 * 1024 * 1024  # 50MB

        try:
            # SpooledTemporaryFile: 10MB 内存阈值
            with tempfile.SpooledTemporaryFile(max_size=10 * 1024 * 1024) as tmp:
                # 分块读取文件
                while chunk := await file.read(8192):
                    sha256_hash.update(chunk)
                    tmp.write(chunk)
                    total_size += len(chunk)

                    # 检查大小限制
                    if total_size > MAX_TARBALL_SIZE:
                        raise AppError(
                            code=ErrorCodes.VERSION_CONTENT_TOO_LARGE,
                            message=f"Package file size exceeds limit ({total_size} bytes), maximum allowed {MAX_TARBALL_SIZE} bytes (50MB)",
                            status_code=413,
                        )

                sha256 = sha256_hash.hexdigest()

                # 重置文件指针
                tmp.seek(0)

                # 使用线程池上传到 MinIO
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(
                    None,
                    lambda: self.client.put_object(
                        Bucket=self.bucket,
                        Key=object_path,
                        Body=tmp,
                        ContentType="application/gzip",
                        Metadata={"sha256": sha256},
                    ),
                )

                # 验证文件完整性 - 与 upload_tarball 保持一致
                head = await loop.run_in_executor(
                    None,
                    lambda: self.client.head_object(Bucket=self.bucket, Key=object_path),
                )
                if head["ContentLength"] != total_size:
                    raise AppError(
                        code=ErrorCodes.STORAGE_INTEGRITY_ERROR,
                        message="File integrity verification failed",
                        status_code=500,
                    )

            return object_path, sha256, total_size
        except AppError:
            raise
        except Exception as e:
            raise AppError(
                code=ErrorCodes.STORAGE_UPLOAD_FAILED,
                message=f"File upload failed: {str(e)}",
                status_code=500,
            )

    async def upload_content(self, object_path: str, data: bytes) -> None:
        """上传内容文件到 MinIO (用于 Skill content)"""
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                lambda: self.client.put_object(
                    Bucket=self.bucket,
                    Key=object_path,
                    Body=data,
                    ContentType="text/markdown",
                ),
            )
        except Exception as e:
            raise AppError(
                code=ErrorCodes.STORAGE_UPLOAD_FAILED,
                message=f"Content upload failed: {str(e)}",
                status_code=500,
            )

    async def get_presigned_url(self, object_path: str, expires: int = 900) -> str:
        """生成预签名下载 URL (默认 15 分钟)"""
        try:
            loop = asyncio.get_running_loop()
            url = await loop.run_in_executor(
                None,
                lambda: self.client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket, "Key": object_path},
                    ExpiresIn=expires,
                ),
            )
            return url
        except Exception as e:
            raise AppError(
                code=ErrorCodes.STORAGE_DOWNLOAD_FAILED,
                message=f"Failed to generate download URL: {str(e)}",
                status_code=500,
            )

    async def delete_tarball(self, object_path: str) -> None:
        """删除包文件"""
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                lambda: self.client.delete_object(Bucket=self.bucket, Key=object_path),
            )
        except Exception as e:
            raise AppError(
                code=ErrorCodes.STORAGE_DELETE_FAILED,
                message=f"Failed to delete file: {str(e)}",
                status_code=500,
            )

    async def get_tarball_size(self, object_path: str) -> int:
        """获取文件大小"""
        try:
            loop = asyncio.get_running_loop()
            head = await loop.run_in_executor(
                None,
                lambda: self.client.head_object(Bucket=self.bucket, Key=object_path),
            )
            return head["ContentLength"]
        except Exception as e:
            logger.warning(f"Failed to get file size {object_path}: {e}")
            return 0
