/**
 * VersionList 组件 - 版本列表
 */

import { VersionResponse } from '../lib/api';

interface VersionListProps {
  versions: VersionResponse[];
}

export function VersionList({ versions }: VersionListProps) {
  if (versions.length === 0) {
    return <p className="text-muted-foreground">暂无版本</p>;
  }

  return (
    <div className="space-y-2">
      {versions.map((ver) => (
        <div
          key={ver.id}
          className="flex items-center justify-between p-3 border rounded-md"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono">{ver.version}</span>
            {ver.tag && (
              <span className="px-2 py-0.5 text-xs bg-secondary rounded-full">
                {ver.tag}
              </span>
            )}
            {ver.deprecated && (
              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                deprecated
              </span>
            )}
            {ver.yanked && (
              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                yanked
              </span>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {new Date(ver.published_at).toLocaleDateString('zh-CN')}
          </div>
        </div>
      ))}
    </div>
  );
}
