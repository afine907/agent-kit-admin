import { CheckCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DimensionResult {
  status: string;
  detail: Record<string, unknown>;
}

interface HealthCheckBadgeProps {
  overall: string;
  compliance: DimensionResult;
  content: DimensionResult;
  functional: DimensionResult;
  freshness: DimensionResult;
  checkedAt?: string;
  onRecheck?: () => void;
}

const STATUS_ICON: Record<string, typeof CheckCircle> = {
  pass: CheckCircle,
  fail: AlertTriangle,
  warn: AlertTriangle,
  error: AlertTriangle,
  skip: Clock,
};

export function HealthCheckBadge({
  overall,
  compliance,
  content,
  functional,
  freshness,
  checkedAt,
  onRecheck,
}: HealthCheckBadgeProps) {
  const { t } = useTranslation('components');

  if (overall === 'pending') {
    return (
      <div className="p-4 rounded-xl bg-card border border-border/50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{t('health.pending', '待检测')}</span>
        </div>
      </div>
    );
  }

  const isHealthy = overall === 'healthy';

  const dimensions = [
    { label: t('health.compliance', '静态合规'), result: compliance },
    { label: t('health.content', '内容可访问'), result: content },
    { label: t('health.functional', '功能实测'), result: functional },
    { label: t('health.freshness', '版本新鲜度'), result: freshness },
  ];

  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
      <div className="flex items-center gap-2">
        {isHealthy ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        )}
        <span className="text-sm font-medium">
          {isHealthy
            ? t('health.healthy', 'Skill 健康')
            : t('health.degraded', 'Skill 状态异常')}
        </span>
      </div>

      <div className="space-y-1.5 pl-6">
        {dimensions.map(({ label, result }) => {
          const Icon = STATUS_ICON[result.status] || Clock;
          const colorClass =
            result.status === 'pass'
              ? 'text-green-500'
              : result.status === 'warn'
                ? 'text-amber-500'
                : result.status === 'fail' || result.status === 'error'
                  ? 'text-red-500'
                  : 'text-muted-foreground';
          return (
            <div key={label} className="flex items-center gap-1.5 text-xs">
              <Icon className={`w-3 h-3 ${colorClass}`} />
              <span className="text-muted-foreground">{label}:</span>
              <span className={colorClass}>{result.status}</span>
            </div>
          );
        })}
      </div>

      {checkedAt && (
        <div className="text-xs text-muted-foreground pt-2 border-t border-border/30">
          {t('health.checkedAt', '检测时间')}: {new Date(checkedAt).toLocaleString('zh-CN')}
        </div>
      )}

      {onRecheck && (
        <button
          onClick={onRecheck}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <RefreshCw className="w-3 h-3" />
          {t('health.recheck', '重新检测')}
        </button>
      )}
    </div>
  );
}
