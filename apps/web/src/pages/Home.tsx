/**
 * Home 页面 - shadcn 风格，质感升级
 */

import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SearchBar } from '../components/SearchBar'
import { PackageCard } from '../components/PackageCard'
import { usePackages } from '../hooks/usePackages'
import { PackageResponse } from '../lib/api'
import { Card } from '@/components/ui/card'
import { Boxes, ChevronLeft, ChevronRight, AlertCircle, ArrowUpDown } from 'lucide-react'

type SortOption = 'newest' | 'downloads' | 'name'

const SORT_CONFIG: Record<SortOption, { sort: string; order: string; label: string }> = {
  newest: { sort: 'created_at', order: 'desc', label: '最新' },
  downloads: { sort: 'downloads', order: 'desc', label: '最热' },
  name: { sort: 'name', order: 'asc', label: '名称' },
}

export default function Home() {
  const { t } = useTranslation('pages')
  const [search, setSearch] = useState('')
  const [searchParams] = useSearchParams()
  const workspaceScope = searchParams.get('scope') || undefined
  const [type, setType] = useState<string | undefined>()
  const [sort, setSort] = useState<SortOption>('newest')
  const [page, setPage] = useState(1)

  const sortConfig = SORT_CONFIG[sort]

  const { data, isLoading, error } = usePackages({
    search: search || undefined,
    type,
    scope: workspaceScope,
    sort: sortConfig.sort,
    order: sortConfig.order,
    page,
    per_page: 20,
  })

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const handleTypeChange = useCallback((newType: string | undefined) => {
    setType(newType)
    setPage(1)
  }, [])

  const handleSortChange = useCallback((newSort: SortOption) => {
    setSort(newSort)
    setPage(1)
  }, [])

  const TYPE_FILTERS = [
    { value: undefined, label: t('home.filterAll') },
    { value: 'mcp', label: 'MCP' },
    { value: 'skill', label: 'Skill' },
  ] as const

  const mcpCount = data?.data.filter((p: PackageResponse) => p.type === 'mcp').length ?? 0
  const skillCount = data?.data.filter((p: PackageResponse) => p.type === 'skill').length ?? 0

  return (
    <div className="container mx-auto py-10">
      {/* Hero */}
      <Card className="relative mb-10 p-8 overflow-hidden border-primary/10 shadow-lg shadow-primary/5">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8 rounded-inherit" />
        <div className="absolute inset-0 bg-dot-grid opacity-30" />
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/10">
              <Boxes className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                {t('home.title')}
              </h1>
              <p className="text-muted-foreground mt-0.5">{t('home.subtitle')}</p>
            </div>
          </div>

          {/* 统计数据 */}
          {data?.pagination && (
            <div className="flex items-center gap-6 pt-4 border-t border-border/30">
              <button className="flex items-center gap-2 group cursor-default">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  <span className="font-mono font-semibold text-foreground">{data.pagination.total}</span> 全部
                </span>
              </button>
              <button onClick={() => handleTypeChange('mcp')} className="flex items-center gap-2 group">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  <span className="font-mono font-semibold text-foreground">{mcpCount}</span> MCP
                </span>
              </button>
              <button onClick={() => handleTypeChange('skill')} className="flex items-center gap-2 group">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  <span className="font-mono font-semibold text-foreground">{skillCount}</span> Skills
                </span>
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* 搜索和筛选 */}
      <div className="flex gap-3 mb-8">
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={handleSearch}
            placeholder={t('home.searchPlaceholder')}
          />
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-xl border shadow-sm">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => handleTypeChange(f.value)}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                type === f.value
                  ? 'bg-primary text-primary-foreground shadow-sm glow-cyan'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className="flex items-center gap-2 px-4 py-2 pr-8 text-sm font-medium bg-muted border rounded-xl shadow-sm appearance-none cursor-pointer hover:bg-muted/80 transition-all"
          >
            {(Object.entries(SORT_CONFIG) as [SortOption, typeof sortConfig][]).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* 加载 */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 animate-pulse">
              <div className="h-4 w-3/4 rounded bg-muted mb-3" />
              <div className="h-3 w-full rounded bg-muted mb-2" />
              <div className="h-3 w-2/3 rounded bg-muted mb-4" />
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded bg-muted" />
                <div className="h-5 w-12 rounded bg-muted" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 错误 */}
      {error && (
        <Card className="flex flex-col items-center justify-center py-16 border-destructive/20">
          <AlertCircle className="w-8 h-8 text-destructive mb-3" />
          <p className="text-destructive font-semibold text-lg mb-1">{t('error.loadFailed')}</p>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </Card>
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
            <Card className="flex flex-col items-center justify-center py-20 border-dashed">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-muted-foreground text-base mb-1">{t('home.noResults')}</p>
              <p className="text-sm text-muted-foreground/60">{t('home.noResultsHint')}</p>
            </Card>
          )}

          {/* 分页 */}
          {data.pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm border rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                {t('pagination.prev')}
              </button>
              <span className="px-5 py-2 text-sm font-mono bg-muted rounded-xl border">
                {t('pagination.pageInfo', { page, total: data.pagination.total_pages })}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === data.pagination.total_pages}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm border rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-all"
              >
                {t('pagination.next')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
