import type { DashboardEvent } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

interface MarketCardProps {
  event: DashboardEvent;
  index: number;
}

export function MarketCard({ event, index }: MarketCardProps) {
  const hasDiscrepancy = event.discrepancy && event.discrepancy.spread > 0.03;

  return (
    <article
      className={`bg-surface-elevated border rounded-xl p-5 transition-all duration-300 animate-slide-up ${
        hasDiscrepancy 
          ? "border-accent/30 hover:border-accent/50 shadow-lg shadow-accent/5" 
          : "border-surface-border hover:border-zinc-700"
      }`}
      style={{ animationDelay: `${index * 80}ms`, opacity: 0 }}
    >
      {/* Category & Discrepancy Badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <span className="text-[10px] font-mono uppercase tracking-wider text-accent bg-accent/10 px-2 py-1 rounded">
          {event.category}
        </span>
        {hasDiscrepancy && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-positive">
              {(event.discrepancy!.spread * 100).toFixed(1)}% spread
            </span>
          </div>
        )}
      </div>

      {/* Question */}
      <h2 className="text-sm font-medium leading-snug mb-5 text-zinc-100">
        {event.title}
      </h2>

      {/* Platform Odds */}
      <div className="space-y-2.5">
        {event.markets.map((market) => (
          <div
            key={market.platform}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-zinc-500 w-24 truncate font-medium">
              {formatPlatformName(market.platform)}
            </span>
            <div className="flex items-center gap-3 font-mono">
              <ProbabilityBadge 
                value={market.yesProbability} 
                isBest={market.isBestYes}
                type="yes"
              />
              <ProbabilityBadge 
                value={market.noProbability} 
                isBest={market.isBestNo}
                type="no"
              />
              {market.volume && (
                <span className="w-16 text-right text-zinc-600">
                  {formatVolume(market.volume)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* News Section */}
      {event.recentNews.length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-border">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-2">
            Likely Drivers
          </p>
          <div className="space-y-2">
            {event.recentNews.map((news, i) => (
              <a
                key={i}
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <p className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors line-clamp-1">
                  {news.title}
                </p>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {news.source} · {formatDistanceToNow(new Date(news.publishedAt), { addSuffix: true })}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-surface-border flex justify-between items-center text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
        <span>Yes / No / Vol</span>
        {event.discrepancy && (
          <span className={`${
            event.discrepancy.confidence > 0.7 ? "text-positive" : "text-zinc-500"
          }`}>
            {(event.discrepancy.confidence * 100).toFixed(0)}% confidence
          </span>
        )}
      </div>
    </article>
  );
}

function ProbabilityBadge({ 
  value, 
  isBest, 
  type 
}: { 
  value: number; 
  isBest: boolean; 
  type: "yes" | "no";
}) {
  const baseClass = "w-14 text-right px-1.5 py-0.5 rounded";
  
  if (isBest) {
    return (
      <span className={`${baseClass} font-medium ${
        type === "yes" ? "text-positive bg-positive/10" : "text-negative bg-negative/10"
      }`}>
        {(value * 100).toFixed(0)}¢
      </span>
    );
  }

  return (
    <span className={`${baseClass} text-zinc-400`}>
      {(value * 100).toFixed(0)}¢
    </span>
  );
}

function formatPlatformName(platform: string): string {
  const names: Record<string, string> = {
    POLYMARKET: "Polymarket",
    KALSHI: "Kalshi",
    PREDICTIT: "PredictIt",
    METACULUS: "Metaculus",
  };
  return names[platform] || platform;
}

function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(0)}K`;
  }
  return `$${volume}`;
}
