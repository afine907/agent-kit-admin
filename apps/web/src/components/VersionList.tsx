/**
 * VersionList 组 - 版本列表 (终端风格)
 */

import { VersionResponse } from '../lib/api';
import { Tag, AlertTriangle, Ban } from 'lucide-react';

interface VersionListProps {
  versions: VersionResponse[];
}

export function VersionList({ versions }: VersionListProps) {
  if (versions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground font-mono">No versions published yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {versions.map((ver, i) => (
        <div
          key={ver.id}
          className="flex items-center justify-between px-4 py-3 rounded-lg bg-secondary/30 border border-border/30 hover:border-border/60 transition-colors animate-fade-in-up"
          style={{ animationDelay: `${i * 40}ms` }}
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
            {ver.deprecated && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-accent/10 text-accent border border-accent/20 rounded-md">
                <AlertTriangle className="w-2.5 h-2.5" />
                deprecated
              </span>
            )}
            {ver.yanked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
                <Ban className="w-2.5 h-2.5" />
                yanked
              </span>
            )}
          </div>

          <time className="text-xs text-muted-foreground font-mono">
            {new Date(ver.published_at).toLocaleDateString('zh-CN')}
          </time>
        </div>
      ))}
    </div>
  );
}
