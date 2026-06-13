/**
 * PackageDetail 页面 - 包详情
 */

import { useParams, Link } from 'react-router-dom';
import { usePackage, useVersions } from '../hooks/usePackages';
import { VersionList } from '../components/VersionList';
import { InstallCommand } from '../components/InstallCommand';

export default function PackageDetail() {
  const { scope, name } = useParams<{ scope: string; name: string }>();

  const { data: pkg, isLoading, error } = usePackage(scope || '', name || '');
  const { data: versions } = useVersions(scope || '', name || '');

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-red-500">包不存在或加载失败</p>
        <Link to="/" className="text-primary hover:underline mt-4 block">
          返回包列表
        </Link>
      </div>
    );
  }

  const typeLabel = pkg.type === 'mcp' ? 'MCP' : 'Skill';
  const typeColor = pkg.type === 'mcp' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';

  return (
    <div className="container mx-auto py-8">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground">
          包列表
        </Link>
        <span>/</span>
        <span className="text-foreground">{pkg.full_name}</span>
      </div>

      {/* 包信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧 - 主要信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 标题 */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{pkg.full_name}</h1>
              <span className={`px-2 py-0.5 text-xs rounded-full ${typeColor}`}>
                {typeLabel}
              </span>
            </div>
            <p className="text-muted-foreground mt-2">
              {pkg.description || '-'}
            </p>
          </div>

          {/* 安装命令 */}
          <div>
            <h2 className="text-lg font-semibold mb-2">安装</h2>
            <InstallCommand scope={pkg.scope} name={pkg.name} />
          </div>

          {/* 标签 */}
          {pkg.tags.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">标签</h2>
              <div className="flex flex-wrap gap-2">
                {pkg.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-sm bg-secondary rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 版本列表 */}
          <div>
            <h2 className="text-lg font-semibold mb-2">版本</h2>
            <VersionList versions={versions?.data || []} />
          </div>
        </div>

        {/* 右侧 - 元信息 */}
        <div className="space-y-4">
          <div className="p-4 border rounded-lg space-y-3">
            <h3 className="font-semibold">信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">最新版本</span>
                <span>{pkg.latest_version || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">下载量</span>
                <span>{pkg.downloads_count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">许可证</span>
                <span>{pkg.license || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">可见性</span>
                <span>{pkg.visibility}</span>
              </div>
              {pkg.repository && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">仓库</span>
                  <a
                    href={pkg.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate ml-2"
                  >
                    GitHub
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border rounded-lg space-y-3">
            <h3 className="font-semibold">时间</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">创建时间</span>
                <span>{new Date(pkg.created_at).toLocaleDateString('zh-CN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">更新时间</span>
                <span>{new Date(pkg.updated_at).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
