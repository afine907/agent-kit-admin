/**
 * Home 页面 - 包列表 + 搜索
 */

import { useState, useCallback } from 'react';
import { SearchBar } from '../components/SearchBar';
import { PackageCard } from '../components/PackageCard';
import { usePackages } from '../hooks/usePackages';
import { PackageResponse } from '../lib/api';

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
    <div className="container mx-auto py-8">
      {/* 标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Agent Kit Registry</h1>
        <p className="text-muted-foreground mt-2">
          搜索和安装 AI Agent 包 - MCP 服务器和 Agent Skills
        </p>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={handleSearch}
            placeholder="搜索包名或描述..."
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleTypeChange(undefined)}
            className={`px-4 py-2 text-sm rounded-md ${
              !type
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => handleTypeChange('mcp')}
            className={`px-4 py-2 text-sm rounded-md ${
              type === 'mcp'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            MCP
          </button>
          <button
            onClick={() => handleTypeChange('skill')}
            className={`px-4 py-2 text-sm rounded-md ${
              type === 'skill'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            Skill
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500">加载失败: {(error as Error).message}</p>
        </div>
      )}

      {/* 包列表 */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.data.map((pkg: PackageResponse) => (
              <PackageCard key={pkg.id} package={pkg} />
            ))}
          </div>

          {/* 空状态 */}
          {data.data.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">未找到匹配的包</p>
            </div>
          )}

          {/* 分页 */}
          {data.pagination.total_pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50"
              >
                上一页
              </button>
              <span className="px-3 py-1 text-sm text-muted-foreground">
                {page} / {data.pagination.total_pages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === data.pagination.total_pages}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
