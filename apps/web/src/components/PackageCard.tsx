/**
 * PackageCard 组 - 包卡片 (终端风格)
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { PackageResponse } from '../lib/api';
import { Download, Tag } from 'lucide-react';

interface PackageCardProps {
  package: PackageResponse;
  index?: number;
}

export const PackageCard = React.memo(function PackageCard({ package: pkg, index = 0 }: PackageCardProps) {
  const isMCP = pkg.type === 'mcp';

  return (
    <Link
      to={`/packages/${pkg.scope}/${pkg.name}`}
      className="group block p-5 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 card-glow animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {pkg.full_name}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium rounded-md ${
                isMCP
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-accent/10 text-accent border border-accent/20'
              }`}
            >
              {isMCP ? 'MCP' : 'SKILL'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
            {pkg.description || '暂无描述'}
          </p>
        </div>
      </div>

      {/* 元信息 */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
        {pkg.latest_version && (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground">
            <Tag className="w-3 h-3" />
            v{pkg.latest_version}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Download className="w-3 h-3" />
          {pkg.downloads_count.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground/60 ml-auto">
          {pkg.license}
        </span>
      </div>

      {/* 标签 */}
      {pkg.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {pkg.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[10px] font-mono bg-secondary/80 text-muted-foreground rounded-md"
            >
              {tag}
            </span>
          ))}
          {pkg.tags.length > 4 && (
            <span className="text-[10px] text-muted-foreground/50">
              +{pkg.tags.length - 4}
            </span>
          )}
        </div>
      )}
    </Link>
  );
});
