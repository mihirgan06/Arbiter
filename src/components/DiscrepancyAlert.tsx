import type { DiscrepancyResult } from "@/lib/types";

interface DiscrepancyAlertProps {
  discrepancies: DiscrepancyResult[];
}

export function DiscrepancyAlert({ discrepancies }: DiscrepancyAlertProps) {
  if (discrepancies.length === 0) return null;

  const topDiscrepancy = discrepancies[0];

  return (
    <div className="mb-8 animate-fade-in">
      <div className="bg-gradient-to-r from-accent/10 via-accent/5 to-transparent border border-accent/20 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-accent mb-1">
                {discrepancies.length} Active Discrepanc{discrepancies.length === 1 ? "y" : "ies"} Detected
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Largest spread: <span className="text-zinc-200 font-medium">{topDiscrepancy.eventTitle}</span>
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Spread</span>
                  <span className="text-sm font-mono font-medium text-positive">
                    {(topDiscrepancy.maxSpread * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Confidence</span>
                  <span className="text-sm font-mono font-medium text-zinc-200">
                    {(topDiscrepancy.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Platforms</span>
                  <span className="text-sm font-mono text-zinc-400">
                    {topDiscrepancy.markets.map((m) => formatPlatform(m.platform)).join(" vs ")}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {topDiscrepancy.likelyDrivers.length > 0 && (
            <div className="hidden lg:block text-right shrink-0">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                Likely Driver
              </p>
              <p className="text-xs text-zinc-400 max-w-xs truncate">
                {topDiscrepancy.likelyDrivers[0].title}
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">
                {topDiscrepancy.likelyDrivers[0].source}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPlatform(platform: string): string {
  const names: Record<string, string> = {
    POLYMARKET: "Poly",
    KALSHI: "Kalshi",
    PREDICTIT: "PI",
    METACULUS: "Meta",
  };
  return names[platform] || platform;
}

