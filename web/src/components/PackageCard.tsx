/**
 * PackageCard 组件 - 包卡片
 */

import { Link } from 'react-router-dom';
import { PackageResponse } from '../lib/api';

interface PackageCardProps {
  package: PackageResponse;
}

export function PackageCard({ package: pkg }: PackageCardProps) {
  const typeLabel = pkg.type === 'mcp' ? 'MCP' : 'Skill';
  const typeColor = pkg.type === 'mcp' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';

  return (
    <Link
      to={`/packages/${pkg.scope}/${pkg.name}`}
      className="block p-4 border rounded-lg hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{pkg.full_name}</h3>
            <span className={`px-2 py-0.5 text-xs rounded-full ${typeColor}`}>
              {typeLabel}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {pkg.description || '-'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        {pkg.latest_version && (
          <span>v{pkg.latest_version}</span>
        )}
        <span>↓ {pkg.downloads_count.toLocaleString()}</span>
        <span>{pkg.license}</span>
      </div>

      {pkg.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {pkg.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-secondary rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
