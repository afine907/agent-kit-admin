/**
 * PackageCard - shadcn 风格，质感升级
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PackageResponse } from '../lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Download, Tag, Zap, Boxes } from 'lucide-react'

interface PackageCardProps {
  package: PackageResponse
  index?: number
}

const TYPE_META = {
  mcp: { icon: Zap, color: 'text-primary bg-primary/10 border-primary/20', label: 'MCP' },
  skill: { icon: Boxes, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', label: 'SKILL' },
}

export const PackageCard = React.memo(function PackageCard({ package: pkg, index = 0 }: PackageCardProps) {
  const { t } = useTranslation('common')
  const isMCP = pkg.type === 'mcp'
  const meta = isMCP ? TYPE_META.mcp : TYPE_META.skill
  const TypeIcon = meta.icon

  return (
    <Link
      to={`/packages/${pkg.scope}/${pkg.name}`}
      className="group block animate-fade-in-up focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <Card className="p-5 h-full hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
        {/* Header: scope + type */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Scope badge */}
            <Badge variant="outline" className="text-xs font-mono bg-muted/50">
              @{pkg.scope}
            </Badge>
            {/* Type badge */}
            <Badge className={`text-xs border ${meta.color}`}>
              <TypeIcon className="w-3 h-3 mr-1" />
              {meta.label}
            </Badge>
          </div>
          {pkg.license && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {pkg.license}
            </Badge>
          )}
        </div>

        {/* 包名 */}
        <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors mb-1.5">
          {pkg.name}
        </h3>

        {/* 描述 */}
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-4">
          {pkg.description || t('empty.noDescription')}
        </p>

        {/* 标签 */}
        {pkg.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {pkg.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono bg-muted rounded-md text-muted-foreground">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
            {pkg.tags.length > 3 && (
              <span className="text-[11px] text-muted-foreground/60">+{pkg.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer: 版本 + 下载量 */}
        <div className="flex items-center gap-4 pt-3 border-t border-border/50">
          {pkg.latest_version && (
            <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground">
              <Tag className="w-3 h-3" />
              v{pkg.latest_version}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Download className="w-3 h-3" />
            {pkg.downloads_count > 1000
              ? `${(pkg.downloads_count / 1000).toFixed(1)}k`
              : pkg.downloads_count}
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground/60">@{pkg.scope}</span>
        </div>
      </Card>
    </Link>
  )
})
