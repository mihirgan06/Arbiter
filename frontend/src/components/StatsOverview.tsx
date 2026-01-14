interface StatsOverviewProps {
  stats: {
    totalMarkets: number;
    activeDiscrepancies: number;
    avgSpread: number;
  };
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <StatCard
        label="Total Markets"
        value={stats.totalMarkets}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      />
      <StatCard
        label="Active Discrepancies"
        value={stats.activeDiscrepancies}
        highlight={stats.activeDiscrepancies > 0}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
      />
      <StatCard
        label="Avg Spread"
        value={`${(stats.avgSpread * 100).toFixed(1)}%`}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        }
      />
      <StatCard
        label="Platforms"
        value="4"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        }
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-surface-elevated border rounded-xl p-4 ${
      highlight ? "border-accent/30" : "border-surface-border"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`${highlight ? "text-accent" : "text-zinc-500"}`}>
          {icon}
        </span>
        {highlight && (
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        )}
      </div>
      <p className={`text-2xl font-semibold font-mono ${
        highlight ? "text-accent" : "text-zinc-100"
      }`}>
        {value}
      </p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  );
}

