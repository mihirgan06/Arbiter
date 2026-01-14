"use client";

import { useState } from "react";

interface HeaderProps {
  stats?: {
    totalMarkets: number;
    activeDiscrepancies: number;
    avgSpread: number;
  };
}

export function Header({ stats }: HeaderProps) {
  const [lastUpdated] = useState(new Date());

  return (
    <header className="border-b border-surface-border bg-surface-elevated/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-muted flex items-center justify-center shadow-lg shadow-accent/20">
              <span className="text-surface font-bold text-sm">A</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Arbiter</h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                Prediction Market Intelligence
              </p>
            </div>
          </div>

          {stats && (
            <div className="hidden md:flex items-center gap-6">
              <StatPill label="Markets" value={stats.totalMarkets} />
              <StatPill 
                label="Discrepancies" 
                value={stats.activeDiscrepancies} 
                highlight={stats.activeDiscrepancies > 0}
              />
              <StatPill 
                label="Avg Spread" 
                value={`${(stats.avgSpread * 100).toFixed(1)}%`} 
              />
            </div>
          )}

          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono text-zinc-600">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
              <span className="text-xs text-zinc-400">Live</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function StatPill({ 
  label, 
  value, 
  highlight = false 
}: { 
  label: string; 
  value: string | number; 
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-sm font-mono font-medium ${
        highlight ? "text-accent" : "text-zinc-100"
      }`}>
        {value}
      </span>
    </div>
  );
}
