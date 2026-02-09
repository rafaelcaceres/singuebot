import React from 'react';

interface MetricsData {
  activeNow: number;
  needsAttention: number;
  unread: number;
  todayActivity: number;
}

interface MetricsBarProps {
  metrics: MetricsData | undefined;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics }) => {
  const isLoading = metrics === undefined;

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-6">
        {/* Active Now */}
        <MetricCard
          label="Ativas agora"
          value={metrics?.activeNow}
          isLoading={isLoading}
          variant="default"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />

        {/* Needs Attention */}
        <MetricCard
          label="Precisam atenção"
          value={metrics?.needsAttention}
          isLoading={isLoading}
          variant={metrics?.needsAttention ? 'danger' : 'default'}
          pulse={!!metrics?.needsAttention && metrics.needsAttention > 0}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />

        {/* Unread */}
        <MetricCard
          label="Não lidas"
          value={metrics?.unread}
          isLoading={isLoading}
          variant={metrics?.unread ? 'warning' : 'default'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />

        {/* Today */}
        <MetricCard
          label="Hoje"
          value={metrics?.todayActivity}
          isLoading={isLoading}
          variant="default"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: number | undefined;
  isLoading: boolean;
  variant: 'default' | 'warning' | 'danger';
  pulse?: boolean;
  icon: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  isLoading,
  variant,
  pulse,
  icon,
}) => {
  const variantStyles = {
    default: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      icon: 'text-gray-500',
    },
    warning: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      icon: 'text-yellow-500',
    },
    danger: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      icon: 'text-red-500',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-lg ${styles.bg} ${
        pulse ? 'animate-pulse' : ''
      }`}
    >
      <div className={styles.icon}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        {isLoading ? (
          <div className="h-6 w-8 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className={`text-xl font-bold ${styles.text}`}>{value ?? 0}</p>
        )}
      </div>
    </div>
  );
};
