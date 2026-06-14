"""认证相关的 Pydantic schemas"""

from pydantic import BaseModel, Field, EmailStr
import re


class RegisterRequest(BaseModel):
    """注册请求"""

    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., min_length=8, max_length=128, description="密码")
    display_name: str | None = Field(None, max_length=100, description="显示名称")

    def model_post_init(self, __context) -> None:
        """验证用户名格式"""
        if not re.match(r"^[a-zA-Z0-9_-]+$", self.username):
            raise ValueError("用户名只能包含字母、数字、下划线和连字符")


class LoginRequest(BaseModel):
    """登录请求"""

    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., description="密码")


class RefreshRequest(BaseModel):
    """刷新 Token 请求"""

    refresh_token: str = Field(..., description="Refresh Token")


class AuthResponse(BaseModel):
    """认证响应"""

    token: str
    refresh_token: str | None = None
    user: "UserInfo"


class UserInfo(BaseModel):
    """用户信息"""

    id: str
    username: str
    email: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    role: str = "member"
    status: str = "active"

    class Config:
        from_attributes = True


class CreateAPIKeyRequest(BaseModel):
    """创建 API Key 请求"""

    name: str = Field(..., min_length=1, max_length=100, description="API Key 名称")
