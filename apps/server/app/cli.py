"""CLI 工具 - 管理员初始化等"""

import asyncio
import argparse
from app.core.security import hash_password


async def create_admin(email: str, password: str, username: str = "admin"):
    """创建管理员用户"""
    from app.database import AsyncSessionLocal, engine, Base
    from app.models.user import User
    from sqlalchemy import select

    # 确保表存在
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # 检查用户是否已存在
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            # 升级为 super_admin
            user.role = "super_admin"
            user.status = "active"
            if password:
                user.password_hash = hash_password(password)
            await db.commit()
            print(f"✅ 用户 {email} 已升级为 super_admin")
        else:
            # 创建新用户
            user = User(
                username=username,
                email=email,
                display_name="Super Admin",
                password_hash=hash_password(password),
                oauth_provider="local",
                oauth_id=None,
                role="super_admin",
                status="active",
            )
            db.add(user)
            await db.commit()
            print(f"✅ 创建 super_admin 用户: {email}")

        return user


async def init_database():
    """初始化数据库表"""
    from app.database import engine, Base
    from app.models import user, package, version, download, review  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ 数据库表已创建")


def main():
    parser = argparse.ArgumentParser(description="Agent Kit Admin CLI")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # create-admin 命令
    admin_parser = subparsers.add_parser("create-admin", help="创建管理员用户")
    admin_parser.add_argument("--email", required=True, help="管理员邮箱")
    admin_parser.add_argument("--password", required=True, help="管理员密码")
    admin_parser.add_argument("--username", default="admin", help="用户名 (默认: admin)")

    # init-db 命令
    subparsers.add_parser("init-db", help="初始化数据库表")

    args = parser.parse_args()

    if args.command == "create-admin":
        asyncio.run(create_admin(args.email, args.password, args.username))
    elif args.command == "init-db":
        asyncio.run(init_database())
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
