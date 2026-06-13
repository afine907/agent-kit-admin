"""安全工具 - 密码哈希和 Token 管理"""

import bcrypt


def hash_password(password: str) -> str:
    """哈希密码 - 使用 bcrypt"""
    if not password:
        raise ValueError("Password cannot be empty")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    if plain_password is None:
        raise TypeError("Password cannot be None")
    if not plain_password:
        return False
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )
