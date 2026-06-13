"""安全工具测试 - TDD: 先写测试，再实现"""

import pytest


class TestPasswordHashing:
    """密码哈希测试"""

    def test_hash_password_returns_string(self):
        """哈希密码应返回字符串"""
        from app.core.security import hash_password

        result = hash_password("MyPassword123!")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_hash_password_different_each_time(self):
        """相同密码每次哈希结果不同（因为 salt）"""
        from app.core.security import hash_password

        hash1 = hash_password("SamePassword")
        hash2 = hash_password("SamePassword")
        assert hash1 != hash2

    def test_hash_password_length(self):
        """哈希结果长度应合理（bcrypt 约 60 字符）"""
        from app.core.security import hash_password

        result = hash_password("TestPass")
        assert len(result) >= 50


class TestPasswordVerification:
    """密码验证测试"""

    def test_verify_correct_password(self):
        """正确密码应验证通过"""
        from app.core.security import hash_password, verify_password

        password = "CorrectPassword123!"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_wrong_password(self):
        """错误密码应验证失败"""
        from app.core.security import hash_password, verify_password

        hashed = hash_password("RealPassword")
        assert verify_password("WrongPassword", hashed) is False

    def test_verify_empty_password(self):
        """空密码应验证失败"""
        from app.core.security import hash_password, verify_password

        hashed = hash_password("NonEmpty")
        assert verify_password("", hashed) is False

    def test_verify_none_password_raises(self):
        """None 密码应抛出异常"""
        from app.core.security import verify_password

        with pytest.raises((TypeError, ValueError)):
            verify_password(None, "somehash")
