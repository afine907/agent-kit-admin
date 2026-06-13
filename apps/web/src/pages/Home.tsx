/**
 * Home 页面 - 包列表 + 搜索
 */

import { useState, useCallback } from 'react';
import { SearchBar } from '../components/SearchBar';
import { PackageCard } from '../components/PackageCard';
import { usePackages } from '../hooks/usePackages';
import { PackageResponse } from '../lib/api';
import { Boxes, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

const TYPE_FILTERS = [
  { value: undefined, label: '全部' },
  { value: 'mcp', label: 'MCP' },
  { value: 'skill', label: 'Skill' },
] as const;

export default function Home() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = usePackages({
    search: search || undefined,
    type,
    page,
    per_page: 20,
  });

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleTypeChange = useCallback((newType: string | undefined) => {
    setType(newType);
    setPage(1);
  }, []);

  return (
    <div className="container mx-auto py-10">
      {/* Hero 区域 */}
      <div className="mb-10 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
            <Boxes className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Agent Kit Registry
          </h1>
        </div>
        <p className="text-muted-foreground text-base pl-[52px]">
          搜索和安装 AI Agent 包 — MCP 服务器和 Agent Skills
        </p>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={handleSearch}
            placeholder="搜索包名或描述..."
          />
        </div>
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg border border-border/50">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => handleTypeChange(f.value)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                type === f.value
                  ? 'bg-primary text-primary-foreground shadow-sm glow-cyan'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 加载状态 - Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-xl border border-border/30 animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="h-5 w-3/4 rounded bg-secondary animate-shimmer mb-3" />
              <div className="h-4 w-full rounded bg-secondary animate-shimmer mb-2" />
              <div className="h-4 w-2/3 rounded bg-secondary animate-shimmer mb-4" />
              <div className="flex gap-2">
                <div className="h-3 w-12 rounded bg-secondary animate-shimmer" />
                <div className="h-3 w-16 rounded bg-secondary animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-destructive font-medium mb-1">加载失败</p>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      )}

      {/* 包列表 */}
      {data && (
        <>
          {data.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.data.map((pkg: PackageResponse, i: number) => (
                <PackageCard key={pkg.id} package={pkg} index={i} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-muted-foreground">未找到匹配的包</p>
            </div>
          )}

          {/* 分页 */}
          {data.pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10 animate-fade-in-up">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border/50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary/50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                上一页
              </button>
              <span className="px-4 py-1.5 text-sm font-mono text-muted-foreground bg-secondary/30 rounded-lg border border-border/30">
                {page} / {data.pagination.total_pages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === data.pagination.total_pages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border/50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary/50 transition-colors"
              >
                下一页
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
