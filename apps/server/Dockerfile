FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY pyproject.toml .

# 安装 Python 依赖（不安装项目本身）
RUN pip install --no-cache-dir \
    fastapi>=0.104.0 \
    "uvicorn[standard]>=0.24.0" \
    "sqlalchemy[asyncio]>=2.0.0" \
    asyncpg>=0.29.0 \
    alembic>=1.13.0 \
    "pydantic-settings[email]>=2.1.0" \
    boto3>=1.34.0 \
    "python-jose[cryptography]>=3.3.0" \
    "passlib[bcrypt]>=1.7.4" \
    python-multipart>=0.0.6 \
    httpx>=0.25.0 \
    cachetools>=5.3.0 \
    email-validator>=2.0.0

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
