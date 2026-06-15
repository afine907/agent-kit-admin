/**
 * 个人资料页面 - 包含用户设置
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { api, APIKeyResponse } from '../lib/api';
import {
  User,
  Mail,
  Shield,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Settings,
  Moon,
  Sun,
  Monitor,
  Globe,
} from 'lucide-react';

export default function Profile() {
  const { t, i18n } = useTranslation(['pages', 'common']);
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);

  const [apiKeys, setApiKeys] = useState<APIKeyResponse[]>([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // 用户设置状态
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(
    () => (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system'
  );
  const [language, setLanguage] = useState(i18n.language);
  const [notifications, setNotifications] = useState({
    email: true,
    browser: true,
    updates: false,
  });

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const loadAPIKeys = async () => {
    try {
      const keys = await api.listAPIKeys();
      setApiKeys(keys);
    } catch (err: unknown) {
      console.error('Failed to load API keys:', err);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.updateProfile({ display_name: displayName });
      // 更新本地 auth store
      const updatedUser = await api.getMe();
      useAuthStore.getState().setAuth(useAuthStore.getState().getToken() || '', updatedUser);
      setIsEditing(false);
    } catch (err: unknown) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      setKeyError(t('profile.apiKey.nameRequired'));
      return;
    }

    try {
      setKeyError(null);
      const result = await api.createAPIKey(newKeyName.trim());
      setCreatedKey(result.key || null);
      setNewKeyName('');
      await loadAPIKeys();
    } catch (err: unknown) {
      setKeyError(err instanceof Error ? err.message : t('profile.apiKey.createFailed'));
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm(t('profile.apiKey.deleteConfirm'))) {
      return;
    }

    try {
      await api.deleteAPIKey(keyId);
      await loadAPIKeys();
    } catch (err: unknown) {
      alert(t('profile.apiKey.deleteFailed') + ': ' + (err instanceof Error ? err.message : t('error.unknownError')));
    }
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const getRoleLabel = (role?: string) => {
    const roles: Record<string, string> = {
      super_admin: t('common:roles.super_admin'),
      admin: t('common:roles.admin'),
      member: t('common:roles.member'),
    };
    return roles[role || ''] || role || '-';
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    // 应用主题
    const root = document.documentElement;
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  const handleNotificationChange = (key: keyof typeof notifications, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }));
    // 保存到 localStorage
    localStorage.setItem('notifications', JSON.stringify({ ...notifications, [key]: value }));
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">{t('profile.pleaseLogin')}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">{t('profile.title')}</h1>

      {/* 基本信息 */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">{t('profile.basicInfo')}</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none"
            >
              {t('common:actions.edit')}
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
                width={80}
                height={80}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-primary" />
            )}
          </div>

          {/* 信息 */}
          <div className="flex-1 space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">{t('profile.username')}</span>
              <p className="font-medium">{user.username}</p>
            </div>

            <div>
              <label htmlFor="displayName" className="text-sm text-muted-foreground">{t('profile.displayName')}</label>
              {isEditing ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  />
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    {saving ? t('common:actions.saving') : t('common:actions.save')}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setDisplayName(user.display_name || '');
                    }}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    {t('common:actions.cancel')}
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
                <span>{t('profile.role', 'Role')}: {getRoleLabel(user.role)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Key 管理 */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">{t('profile.apiKey.title')}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('profile.apiKey.description')}
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
            {t('profile.apiKey.createBtn')}
          </button>
        </div>

        {/* 创建 Key 表单 */}
        {showCreateKey && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <input
                id="keyName"
                name="keyName"
                type="text"
                aria-label={t('profile.apiKey.title')}
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder={t('profile.apiKey.namePlaceholder')}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
              />
              <button
                onClick={handleCreateKey}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                {t('profile.apiKey.create')}
              </button>
              <button
                onClick={() => {
                  setShowCreateKey(false);
                  setCreatedKey(null);
                  setKeyError(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
              >
                {t('common:actions.cancel')}
              </button>
            </div>

            {keyError && (
              <div role="alert" aria-live="polite" className="mt-2 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                {keyError}
              </div>
            )}

            {createdKey && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="font-medium text-green-500">{t('profile.apiKey.createSuccess')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background rounded text-sm font-mono break-all">
                    {createdKey}
                  </code>
                  <button
                    onClick={handleCopyKey}
                    aria-label={t('common:actions.copy')}
                    className="p-2 hover:bg-muted rounded-lg focus-visible:ring-2 focus-visible:ring-primary/20"
                    title={t('common:actions.copy')}
                  >
                    {copiedKey ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('profile.apiKey.saveWarning')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Key 列表 */}
        {apiKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t('profile.apiKey.empty')}</p>
            <p className="text-sm">{t('profile.apiKey.emptyHint')}</p>
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
                    <span>{t('profile.apiKey.permissions')}: {key.permissions.join(', ')}</span>
                    {key.last_used_at && (
                      <>
                        <span>•</span>
                        <span>{t('profile.apiKey.lastUsed')}: {new Date(key.last_used_at).toLocaleDateString(locale)}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{t('profile.apiKey.createdAt')}: {new Date(key.created_at).toLocaleDateString(locale)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteKey(key.id)}
                  aria-label={t('common:actions.delete')}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
                  title={t('common:actions.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 用户设置 */}
      <div className="bg-card rounded-xl border border-border p-6 mt-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="w-5 h-5" />
          <h2 className="text-xl font-semibold">{t('profile.settings.title')}</h2>
        </div>

        <div className="space-y-6">
          {/* 主题设置 */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-3 block">
              {t('profile.settings.theme')}
            </label>
            <div className="flex items-center gap-4">
              {[
                { value: 'light', icon: Sun, label: t('profile.settings.themeLight') },
                { value: 'dark', icon: Moon, label: t('profile.settings.themeDark') },
                { value: 'system', icon: Monitor, label: t('profile.settings.themeSystem') },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value as 'light' | 'dark' | 'system')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    theme === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 语言设置 */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-3 block">
              {t('profile.settings.language')}
            </label>
            <div className="flex items-center gap-4">
              {[
                { value: 'zh', label: '中文' },
                { value: 'en', label: 'English' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleLanguageChange(value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    language === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 通知设置 */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-3 block">
              {t('profile.settings.notifications')}
            </label>
            <div className="space-y-3">
              {[
                { key: 'email', label: t('profile.settings.emailNotifications') },
                { key: 'browser', label: t('profile.settings.browserNotifications') },
                { key: 'updates', label: t('profile.settings.updateNotifications') },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications[key as keyof typeof notifications]}
                    onChange={(e) =>
                      handleNotificationChange(
                        key as keyof typeof notifications,
                        e.target.checked
                      )
                    }
                    className="w-4 h-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
