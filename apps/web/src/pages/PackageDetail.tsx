/**
 * PackageDetail 页面 - 终端风格包详情
 */

import { useParams, Link } from 'react-router-dom';
import { usePackage, useVersions } from '../hooks/usePackages';
import { VersionList } from '../components/VersionList';
import { InstallCommand } from '../components/InstallCommand';
import {
  ChevronRight,
  ArrowLeft,
  Download,
  Tag,
  Shield,
  Calendar,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function PackageDetail() {
  const { scope, name } = useParams<{ scope: string; name: string }>();

  const { data: pkg, isLoading, error } = usePackage(scope || '', name || '');
  const { data: versions } = useVersions(scope || '', name || '');

  if (isLoading) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
        <p className="text-sm text-muted-foreground font-mono">正在加载…</p>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center animate-fade-in-up">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <p className="text-destructive font-medium mb-1">包不存在或加载失败</p>
        <Link
          to="/"
          className="flex items-center gap-1.5 mt-4 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回包列表
        </Link>
      </div>
    );
  }

  const isMCP = pkg.type === 'mcp';

  return (
    <div className="container mx-auto py-8">
      {/* 面包屑 */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-8 animate-fade-in-up">
        <Link to="/" className="hover:text-primary transition-colors">
          包列表
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">{pkg.full_name}</span>
      </div>

      {/* 主内容 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧 - 主要信息 */}
        <div className="lg:col-span-2 space-y-8">
          {/* 标题 */}
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-extrabold tracking-tight">{pkg.full_name}</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 text-xs font-mono font-medium rounded-md ${
                  isMCP
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-accent/10 text-accent border border-accent/20'
                }`}
              >
                {isMCP ? 'MCP' : 'SKILL'}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              {pkg.description || '暂无描述'}
            </p>
          </div>

          {/* 安装命令 */}
          <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-3">
              安装
            </h2>
            <InstallCommand scope={pkg.scope} name={pkg.name} />
          </div>

          {/* 标签 */}
          {pkg.tags.length > 0 && (
            <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-3">
                标签
              </h2>
              <div className="flex flex-wrap gap-2">
                {pkg.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-secondary/50 text-muted-foreground rounded-md border border-border/30"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 版本列表 */}
          <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-3">
              版本历史
            </h2>
            <VersionList versions={versions?.data || []} />
          </div>
        </div>

        {/* 右侧 - 元信息 */}
        <div className="space-y-4">
          {/* 信息卡片 */}
          <div className="p-5 rounded-xl bg-card border border-border/50 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-4">
              信息
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="w-3.5 h-3.5" />
                  最新版本
                </span>
                <span className="font-mono font-medium">{pkg.latest_version || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Download className="w-3.5 h-3.5" />
                  下载量
                </span>
                <span className="font-mono font-medium">{pkg.downloads_count.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Shield className="w-3.5 h-3.5" />
                  许可证
                </span>
                <span className="font-medium">{pkg.license || '-'}</span>
              </div>
              {pkg.repository && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">仓库</span>
                  <a
                    href={pkg.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline font-medium"
                  >
                    GitHub
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* 时间卡片 */}
          <div className="p-5 rounded-xl bg-card border border-border/50 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-4">
              时间
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  创建时间
                </span>
                <span className="text-xs font-mono">
                  {new Date(pkg.created_at).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  更新时间
                </span>
                <span className="text-xs font-mono">
                  {new Date(pkg.updated_at).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
