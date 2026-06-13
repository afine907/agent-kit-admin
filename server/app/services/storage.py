"""MinIO 存储服务"""

import asyncio
import hashlib
import logging
import boto3
from botocore.config import Config
from app.config import get_settings
from app.errors import AppError, ErrorCodes

logger = logging.getLogger(__name__)
settings = get_settings()


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
                    message="文件完整性验证失败",
                    status_code=500,
                )

            return object_path, sha256
        except AppError:
            raise
        except Exception as e:
            raise AppError(
                code=ErrorCodes.STORAGE_UPLOAD_FAILED,
                message=f"文件上传失败: {str(e)}",
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
                message=f"内容上传失败: {str(e)}",
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
                message=f"生成下载链接失败: {str(e)}",
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
                message=f"删除文件失败: {str(e)}",
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
            logger.warning(f"获取文件大小失败 {object_path}: {e}")
            return 0
