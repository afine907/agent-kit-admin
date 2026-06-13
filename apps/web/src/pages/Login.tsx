/**
 * 登录页面 - 终端风格 OAuth 选择
 */

import { useState } from 'react';
import { api } from '../lib/api';
import { Boxes, MessageSquare, Bird, Smartphone, ArrowRight, Shield } from 'lucide-react';

const PROVIDERS = [
  {
    id: 'wechat_work',
    name: '企业微信',
    icon: MessageSquare,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/20',
  },
  {
    id: 'feishu',
    name: '飞书',
    icon: Bird,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
  },
  {
    id: 'dingtalk',
    name: '钉钉',
    icon: Smartphone,
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/20',
  },
];

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const handleLogin = (provider: string) => {
    setLoading(true);
    setSelected(provider);
    window.location.href = api.getOAuthUrl(provider);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4 glow-cyan">
            <Boxes className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Agent Kit</h1>
          <p className="text-sm text-muted-foreground mt-1">登录到包注册中心</p>
        </div>

        {/* 登录按钮组 */}
        <div className="space-y-2.5">
          {PROVIDERS.map((provider, i) => {
            const Icon = provider.icon;
            const isActive = selected === provider.id;
            return (
              <button
                key={provider.id}
                onClick={() => handleLogin(provider.id)}
                disabled={loading}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 group ${
                  isActive
                    ? `${provider.bg} ${provider.border} ring-1 ring-primary/20`
                    : `bg-card border-border/50 hover:border-border hover:bg-secondary/30`
                } disabled:opacity-50`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${provider.bg} ${provider.border}`}>
                  <Icon className={`w-4.5 h-4.5 ${provider.color}`} />
                </div>
                <span className="flex-1 text-left text-sm font-medium">
                  使用 {provider.name} 登录
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </button>
            );
          })}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-muted-foreground/60">
          <Shield className="w-3 h-3" />
          登录即表示您同意我们的服务条款和隐私政策
        </div>
      </div>
    </div>
  );
}
