# 认证设计

## 概述

Agent Kit Admin 支持三种国内主流办公平台的 OAuth 认证：

- 企业微信
- 飞书
- 钉钉

## 认证流程

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  akit   │     │  Caddy  │     │  API    │     │  OAuth  │
│  login  │     │         │     │ Server  │     │ Provider│
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │  GET /auth/oauth/:provider    │               │
     │──────────────►│──────────────►│               │
     │               │               │  302 Redirect │
     │               │◄──────────────│◄──────────────│
     │◄──────────────│               │               │
     │               │               │               │
     │  [用户在浏览器授权]            │               │
     │               │               │               │
     │               │  GET /auth/oauth/:provider/callback
     │               │◄──────────────│◄──────────────│
     │               │               │               │
     │               │               │  获取用户信息  │
     │               │               │──────────────►│
     │               │               │◄──────────────│
     │               │               │               │
     │               │               │  创建/更新用户 │
     │               │               │  生成 JWT     │
     │               │               │               │
     │  POST localhost:PORT/callback  │               │
     │◄──────────────│◄──────────────│               │
     │               │               │               │
     │  保存 Token   │               │               │
     │  输出成功     │               │               │
     │               │               │               │
```

## OAuth Provider 实现

### 企业微信

**申请应用：**
1. 登录 [企业微信管理后台](https://work.weixin.qq.com/)
2. 应用管理 → 自建 → 创建应用
3. 获取 `CorpID` 和 `Secret`
4. 设置回调域名

**OAuth 流程：**

```python
# 1. 构造授权 URL
def get_wechat_work_auth_url(redirect_uri: str) -> str:
    return (
        f"https://open.work.weixin.qq.com/wwopen/sso/qrConnect"
        f"?appid={CORP_ID}"
        f"&agentid={AGENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&state={generate_state()}"
    )

# 2. 获取 access_token
async def get_wechat_work_token(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://qyapi.weixin.qq.com/cgi-bin/gettoken",
            params={
                "corpid": CORP_ID,
                "corpsecret": CORP_SECRET,
            }
        )
        return resp.json()

# 3. 获取用户信息
async def get_wechat_work_user(token: str, code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo",
            params={
                "access_token": token,
                "code": code,
            }
        )
        return resp.json()
```

**环境变量：**
```bash
WECHAT_WORK_CORP_ID=ww1234567890
WECHAT_WORK_AGENT_ID=1000002
WECHAT_WORK_SECRET=your_secret  # 注意：部分文档中也写作 WECHAT_WORK_CORP_SECRET，统一使用此名称
```

---

### 飞书

**申请应用：**
1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 `App ID` 和 `App Secret`
4. 配置重定向 URL

**OAuth 流程：**

```python
# 1. 构造授权 URL
def get_feishu_auth_url(redirect_uri: str) -> str:
    return (
        f"https://open.feishu.cn/open-apis/authen/v1/authorize"
        f"?app_id={APP_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&state={generate_state()}"
    )

# 2. 获取 app_access_token
async def get_feishu_app_token() -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
            json={
                "app_id": APP_ID,
                "app_secret": APP_SECRET,
            }
        )
        return resp.json()["app_access_token"]

# 3. 获取 user_access_token
async def get_feishu_user_token(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token",
            headers={"Authorization": f"Bearer {app_token}"},
            json={"grant_type": "authorization_code", "code": code}
        )
        return resp.json()

# 4. 获取用户信息
async def get_feishu_user(user_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://open.feishu.cn/open-apis/authen/v1/user_info",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        return resp.json()
```

**环境变量：**
```bash
FEISHU_APP_ID=cli_xxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 钉钉

**申请应用：**
1. 登录 [钉钉开放平台](https://open.dingtalk.com/)
2. 创建应用
3. 获取 `AppKey` 和 `AppSecret`
4. 配置登录回调

**OAuth 流程：**

```python
# 1. 构造授权 URL
def get_dingtalk_auth_url(redirect_uri: str) -> str:
    return (
        f"https://login.dingtalk.com/oauth2/auth"
        f"?client_id={APP_KEY}"
        f"&response_type=code"
        f"&scope=openid"
        f"&state={generate_state()}"
        f"&redirect_uri={redirect_uri}"
    )

# 2. 获取 access_token
async def get_dingtalk_token(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.dingtalk.com/v1.0/oauth2/userAccessToken",
            json={
                "clientId": APP_KEY,
                "clientSecret": APP_SECRET,
                "code": code,
                "grantType": "authorization_code",
            }
        )
        return resp.json()

# 3. 获取用户信息
async def get_dingtalk_user(token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.dingtalk.com/v1.0/contact/users/me",
            headers={"x-acs-dingtalk-access-token": token}
        )
        return resp.json()
```

**环境变量：**
```bash
DINGTALK_APP_KEY=dingxxxxxxxxxxxxxxx
DINGTALK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## OAuth State 参数

为防止 CSRF 攻击，OAuth 流程中的 `state` 参数必须是随机生成的值：

```python
import secrets

def generate_state() -> str:
    """生成随机 state 参数，用于防止 CSRF 攻击"""
    return secrets.token_urlsafe(32)

def verify_state(session_state: str, callback_state: str) -> bool:
    """验证 OAuth 回调中的 state 与会话中存储的是否一致"""
    return secrets.compare_digest(session_state, callback_state)
```

服务端在发起 OAuth 请求时，将 state 存储到 session/缓存中；回调时验证 state 是否匹配。

---

## JWT Token

### Token 结构

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-uuid",
    "username": "zhangsan",
    "email": "zhangsan@example.com",
    "iat": 1705312000,
    "exp": 1705398400,
    "iss": "agent-kit-admin"
  }
}
```

### Token 生成

```python
from jose import jwt
from datetime import datetime, timedelta, timezone

def create_access_token(user_id: str, username: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iss": "agent-kit-admin",
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
```

### Token 验证

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
        user = await UserService.get_by_id(payload["sub"])
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## CLI 认证流程

### 浏览器认证（推荐）

```typescript
// cli/src/commands/login.ts
import open from 'open'
import express from 'express'
import chalk from 'chalk'

async function login(serverUrl: string, provider: string = 'wechat_work') {
  const app = express()
  const port = 9876

  // 启动临时 HTTP 服务器接收回调
  const tokenPromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Login timeout (120s)'))
    }, 120_000)

    app.get('/callback', (req, res) => {
      const token = req.query.token as string
      if (!token) {
        res.status(400).send('Missing token parameter')
        reject(new Error('No token received'))
        return
      }
      clearTimeout(timeout)
      res.send('Login successful! You can close this window.')
      resolve(token)
    })
  })

  const httpServer = app.listen(port)

  // 打开浏览器
  const authUrl = `${serverUrl}/auth/oauth/${provider}?callback=http://localhost:${port}/callback`
  await open(authUrl)
  console.log(chalk.blue('🔗 Opening browser for authentication...'))
  console.log(chalk.gray(`   If browser doesn't open, visit: ${authUrl}`))

  try {
    // 等待 token
    const token = await tokenPromise

    // 保存 token
    saveConfig({ server: serverUrl, token })

    console.log(chalk.green('✔ Login successful'))
  } finally {
    httpServer.close()
  }
}
```

### Token 认证（CI/CD）

```bash
# 通过参数
akit login --server https://registry.com --token <token>

# 通过环境变量
export AKIT_SERVER=https://registry.com
export AKIT_TOKEN=<token>
akit publish
```

---

## 权限控制

### 角色定义

| 角色 | 说明 | 权限 |
|---|---|---|
| owner | 团队所有者 | 所有权限 |
| admin | 管理员 | 管理成员、发布包 |
| member | 普通成员 | 发布包到团队 |

### 权限检查

```python
from functools import wraps

def require_role(min_role: str):
    ROLE_HIERARCHY = {"member": 0, "admin": 1, "owner": 2}

    def decorator(func):
        @wraps(func)
        async def wrapper(current_user: User = Depends(get_current_user), **kwargs):
            team_slug = kwargs.get("team_slug")
            if team_slug:
                membership = await TeamService.get_membership(team_slug, current_user.id)
                if not membership:
                    raise HTTPException(403, "Not a team member")
                if ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[min_role]:
                    raise HTTPException(403, "Insufficient permissions")
            return await func(current_user=current_user, **kwargs)
        return wrapper
    return decorator

# 使用
@app.post("/packages/{scope}/{name}/versions")
@require_role("member")
async def publish_version(current_user: User = Depends(get_current_user)):
    ...
```

### 包可见性

| 可见性 | 说明 |
|---|---|
| public | 所有人可见 |
| team | 仅团队成员可见 |
| private | 仅包作者可见 |
