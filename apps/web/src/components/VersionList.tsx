/**
 * VersionList 组件 - 版本列表 (终端风格)
 * 支持 deprecate/yank 操作按钮
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VersionResponse, api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Tag, AlertTriangle, Ban, Loader2 } from 'lucide-react';

interface VersionListProps {
  versions: VersionResponse[];
  /** 包 scope - 传入时显示操作按钮 */
  scope?: string;
  /** 包 name - 传入时显示操作按钮 */
  name?: string;
}

export const VersionList = React.memo(function VersionList({ versions, scope, name }: VersionListProps) {
  const { t, i18n } = useTranslation('pages');
  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';
  const { isAuthenticated } = useAuthStore();

  const showActions = isAuthenticated && !!scope && !!name;

  if (versions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground font-mono">{t('packageDetail.noVersions', 'No versions published yet')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {versions.map((ver, i) => (
        <VersionRow
          key={ver.id}
          ver={ver}
          index={i}
          locale={locale}
          showActions={showActions}
          scope={scope}
          name={name}
        />
      ))}
    </div>
  );
});

interface VersionRowProps {
  ver: VersionResponse;
  index: number;
  locale: string;
  showActions: boolean;
  scope?: string;
  name?: string;
}

function VersionRow({ ver, index, locale, showActions, scope, name }: VersionRowProps) {
  const [loading, setLoading] = useState<'deprecate' | 'yank' | null>(null);
  const [localDeprecated, setLocalDeprecated] = useState(ver.deprecated);
  const [localYanked, setLocalYanked] = useState(ver.yanked);

  const handleToggle = async (action: 'deprecate' | 'yank') => {
    if (!scope || !name || loading) return;
    setLoading(action);

    try {
      if (action === 'deprecate') {
        const newVal = !localDeprecated;
        await api.updateVersion(scope, name, ver.version, { deprecated: newVal });
        setLocalDeprecated(newVal);
      } else {
        const newVal = !localYanked;
        await api.updateVersion(scope, name, ver.version, { yanked: newVal });
        setLocalYanked(newVal);
      }
    } catch {
      // 错误静默处理，UI 保持原状
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-lg bg-secondary/30 border border-border/30 hover:border-border/60 transition-colors animate-fade-in-up"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-medium text-foreground">
          {ver.version}
        </span>
        {ver.tag && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 rounded-md">
            <Tag className="w-2.5 h-2.5" />
            {ver.tag}
          </span>
        )}
        {localDeprecated && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-accent/10 text-accent border border-accent/20 rounded-md">
            <AlertTriangle className="w-2.5 h-2.5" />
            deprecated
          </span>
        )}
        {localYanked && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
            <Ban className="w-2.5 h-2.5" />
            yanked
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {showActions && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleToggle('deprecate')}
              disabled={loading !== null}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded-md border transition-colors disabled:opacity-50 bg-accent/10 text-accent border-accent/20 hover:bg-accent/20"
              aria-label={localDeprecated ? 'undeprecate' : 'deprecate'}
            >
              {loading === 'deprecate' ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <AlertTriangle className="w-2.5 h-2.5" />
              )}
              {localDeprecated ? 'undeprecate' : 'deprecate'}
            </button>
            <button
              onClick={() => handleToggle('yank')}
              disabled={loading !== null}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded-md border transition-colors disabled:opacity-50 bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
              aria-label={localYanked ? 'unyank' : 'yank'}
            >
              {loading === 'yank' ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Ban className="w-2.5 h-2.5" />
              )}
              {localYanked ? 'unyank' : 'yank'}
            </button>
          </div>
        )}
        <time className="text-xs text-muted-foreground font-mono">
          {new Date(ver.published_at).toLocaleDateString(locale)}
        </time>
      </div>
    </div>
  );
}
