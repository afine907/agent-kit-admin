#!/bin/bash
# Agent Kit Admin - MinIO 初始化脚本
# 创建 packages bucket 并设置访问策略

set -e

# 配置
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin_dev_2024}"
BUCKET_NAME="${BUCKET_NAME:-packages}"

echo "=== MinIO 初始化 ==="
echo "Endpoint: $MINIO_ENDPOINT"
echo "Bucket: $BUCKET_NAME"

# 检查 mc 是否可用
if ! command -v mc &> /dev/null; then
    echo "错误: mc (MinIO Client) 未安装"
    echo "请安装: https://min.io/docs/minio/linux/reference/minio-mc.html"
    exit 1
fi

# 设置 alias
echo "设置 MinIO alias..."
mc alias set local "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

# 创建 bucket
echo "创建 bucket: $BUCKET_NAME"
mc mb --ignore-existing "local/$BUCKET_NAME"

# 设置下载策略（允许公开下载）
echo "设置下载策略..."
mc anonymous set download "local/$BUCKET_NAME"

# 验证
echo ""
echo "=== 验证 ==="
mc ls "local/$BUCKET_NAME" || echo "(bucket 为空，正常)"

echo ""
echo "=== MinIO 初始化完成 ==="
echo "Console: http://localhost:9001"
echo "API: $MINIO_ENDPOINT"
echo "Bucket: $BUCKET_NAME"
