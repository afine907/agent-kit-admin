/**
 * 登录页面 - OAuth 跳转
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const PROVIDERS = [
  { id: 'wechat_work', name: '企业微信', icon: '💬' },
  { id: 'feishu', name: '飞书', icon: '🐦' },
  { id: 'dingtalk', name: '钉钉', icon: '📱' },
];

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = (provider: string) => {
    setLoading(true);
    // 跳转到 OAuth 授权页
    window.location.href = api.getOAuthUrl(provider);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6 border rounded-lg shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Agent Kit Admin</h1>
          <p className="text-muted-foreground mt-2">登录到包注册中心</p>
        </div>

        <div className="space-y-3">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleLogin(provider.id)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            >
              <span className="text-xl">{provider.icon}</span>
              <span>使用 {provider.name} 登录</span>
            </button>
          ))}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          登录即表示您同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
