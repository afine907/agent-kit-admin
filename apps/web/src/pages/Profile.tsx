/**
 * 个人资料页面
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { api, APIKeyResponse } from '../lib/api';
import { User, Mail, Calendar, Shield, Key, Plus, Trash2, Copy, Check, AlertCircle } from 'lucide-react';

export default function Profile() {
  const { user, updateToken } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);

  // API Key 状态
  const [apiKeys, setApiKeys] = useState<APIKeyResponse[]>([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const loadAPIKeys = async () => {
    try {
      const keys = await api.listAPIKeys();
      setApiKeys(keys);
    } catch (err: any) {
      console.error('加载 API Key 失败:', err);
    }
  };

  const handleSaveProfile = async () => {
    // TODO: 调用更新用户信息 API
    setSaving(true);
    setTimeout(() => {
      setIsEditing(false);
      setSaving(false);
    }, 500);
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      setKeyError('请输入 API Key 名称');
      return;
    }

    try {
      setKeyError(null);
      const result = await api.createAPIKey(newKeyName.trim());
      setCreatedKey(result.key || null);
      setNewKeyName('');
      await loadAPIKeys();
    } catch (err: any) {
      setKeyError(err.message || '创建失败');
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('确定要删除此 API Key 吗？删除后无法恢复。')) {
      return;
    }

    try {
      await api.deleteAPIKey(keyId);
      await loadAPIKeys();
    } catch (err: any) {
      alert('删除失败: ' + err.message);
    }
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">请先登录</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">个人资料</h1>

      {/* 基本信息 */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">基本信息</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-primary hover:underline"
            >
              编辑
            </button>
          )}
        </div>

        <div className="flex items-start gap-6">
          {/* 头像 */}
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-primary" />
            )}
          </div>

          {/* 信息 */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">用户名</label>
              <p className="font-medium">{user.username}</p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">显示名称</label>
              {isEditing ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setDisplayName(user.display_name || '');
                    }}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <p className="font-medium">{user.display_name || '-'}</p>
              )}
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              {user.email && (
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  <span>{user.email}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                <span>角色: {user.role === 'super_admin' ? '超级管理员' : user.role === 'admin' ? '管理员' : '普通用户'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Key 管理 */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">API Key</h2>
            <p className="text-sm text-muted-foreground mt-1">
              用于 CI/CD 和自动化工具的身份验证
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateKey(true);
              setCreatedKey(null);
              setKeyError(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            创建 Key
          </button>
        </div>

        {/* 创建 Key 表单 */}
        {showCreateKey && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="输入 API Key 名称（例如：CI/CD Token）"
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
              />
              <button
                onClick={handleCreateKey}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                创建
              </button>
              <button
                onClick={() => {
                  setShowCreateKey(false);
                  setCreatedKey(null);
                  setKeyError(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
              >
                取消
              </button>
            </div>

            {keyError && (
              <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                {keyError}
              </div>
            )}

            {createdKey && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="font-medium text-green-500">API Key 创建成功</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background rounded text-sm font-mono break-all">
                    {createdKey}
                  </code>
                  <button
                    onClick={handleCopyKey}
                    className="p-2 hover:bg-muted rounded-lg"
                    title="复制"
                  >
                    {copiedKey ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  ⚠ 请立即保存此 Key，关闭后将无法再次查看完整 Key。
                </p>
              </div>
            )}
          </div>
        )}

        {/* Key 列表 */}
        {apiKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无 API Key</p>
            <p className="text-sm">点击上方按钮创建</p>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{key.name}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                    <code className="font-mono">{key.key_prefix}</code>
                    <span>•</span>
                    <span>权限: {key.permissions.join(', ')}</span>
                    {key.last_used_at && (
                      <>
                        <span>•</span>
                        <span>最后使用: {new Date(key.last_used_at).toLocaleDateString('zh-CN')}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>创建: {new Date(key.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteKey(key.id)}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
