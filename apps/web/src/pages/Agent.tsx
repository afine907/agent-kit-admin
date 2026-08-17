/**
 * Agent 页 - Skill 测试对话
 *
 * 入口：
 * - 独立访问 /agent（通过 Skill 选择器选择）
 * - 从包详情页「测试此 Skill」按钮跳转 /agent?scope=@s&name=n&version=1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, Bot, AlertCircle, Package as PackageIcon } from 'lucide-react';
import { SkillChat } from '@/components/chat/SkillChat';
import { api, PackageResponse, SkillContentResponse } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

export default function Agent() {
  const { t } = useTranslation('pages');
  const { isAuthenticated } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlScope = searchParams.get('scope') || '';
  const urlName = searchParams.get('name') || '';
  const urlVersion = searchParams.get('version') || '';

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PackageResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<{ scope: string; name: string; version: string } | null>(null);
  const [content, setContent] = useState<SkillContentResponse | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  // 从 URL 参数初始化选中状态
  useEffect(() => {
    if (urlScope && urlName) {
      setSelected({ scope: urlScope, name: urlName, version: urlVersion || '' });
    }
  }, [urlScope, urlName, urlVersion]);

  // 搜索 Skill 包
  const handleSearch = useCallback(async () => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const result = await api.listPackages({ search, per_page: 10 });
      setSearchResults(result.data);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [search]);

  // 选中一个 Skill
  const selectSkill = useCallback((pkg: PackageResponse) => {
    const version = pkg.latest_version || '';
    setSelected({ scope: pkg.scope, name: pkg.name, version });
    setSearchParams({ scope: pkg.scope, name: pkg.name, version }, { replace: true });
    setSearchResults([]);
    setSearch('');
  }, [setSearchParams]);

  // 加载 Skill content 展示
  useEffect(() => {
    if (!selected?.version) {
      setContent(null);
      setContentError(null);
      return;
    }
    let cancelled = false;
    setContentError(null);
    api
      .getContent(selected.scope, selected.name, selected.version)
      .then((data) => {
        if (!cancelled) setContent(data);
      })
      .catch((err) => {
        if (!cancelled) setContentError(err instanceof Error ? err.message : '加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center animate-fade-in-up">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 mb-4">
          <Bot className="w-6 h-6 text-primary" />
        </div>
        <p className="text-muted-foreground">{t('agent.loginRequired')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧 - Skill 选择器 + 信息 */}
        <div className="space-y-4">
          {/* 标题 */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">{t('agent.title')}</h1>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('agent.searchPlaceholder')}
              className="pl-9"
            />
          </div>

          {/* 搜索结果 */}
          {searchResults.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card divide-y divide-border/30">
              {searchResults.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => selectSkill(pkg)}
                  className="w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <PackageIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{pkg.full_name}</span>
                  </div>
                  {pkg.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1 pl-5.5">
                      {pkg.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}

          {isSearching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('agent.searching')}
            </div>
          )}

          {/* 当前选中 Skill 信息卡 */}
          {selected && (
            <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
              <div className="flex items-center gap-2">
                <PackageIcon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  @{selected.scope}/{selected.name}
                </span>
              </div>
              {selected.version && (
                <div className="text-xs text-muted-foreground">
                  {t('agent.version')}: <span className="font-mono">{selected.version}</span>
                </div>
              )}

              {/* Skill content 预览 */}
              <div className="pt-2 border-t border-border/30">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('agent.currentSkill')}</p>
                {content ? (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto bg-secondary/30 rounded-lg p-2.5 font-mono">
                    {content.content.slice(0, 500)}
                    {content.content.length > 500 ? '…' : ''}
                  </pre>
                ) : contentError ? (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="w-3 h-3" />
                    {contentError}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {t('agent.loading')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右侧 - 聊天区 */}
        <div className="lg:col-span-2">
          <SkillChat
            scope={selected?.scope}
            name={selected?.name}
            version={selected?.version}
          />
        </div>
      </div>
    </div>
  );
}
