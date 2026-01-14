"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "./Header";
import { StatsOverview } from "./StatsOverview";
import { DiscrepancyAlert } from "./DiscrepancyAlert";
import { MarketCard } from "./MarketCard";
import type { DashboardEvent, DiscrepancyResult } from "@/lib/types";

interface DashboardData {
  events: DashboardEvent[];
  discrepancies: DiscrepancyResult[];
  stats: {
    totalMarkets: number;
    activeDiscrepancies: number;
    avgSpread: number;
  };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/markets");
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || "Failed to fetch data");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredEvents = data?.events.filter((event) => {
    if (filter === "all") return true;
    if (filter === "discrepancies") return event.discrepancy && event.discrepancy.spread > 0.03;
    return event.category.toLowerCase() === filter.toLowerCase();
  }) || [];

  const categories = data 
    ? Array.from(new Set(data.events.map((e) => e.category)))
    : [];

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchData} />;
  }

  if (!data) {
    return <EmptyState />;
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header stats={data.stats} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatsOverview stats={data.stats} />
        
        <DiscrepancyAlert discrepancies={data.discrepancies} />

        {/* Filter Bar */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <FilterButton 
            active={filter === "all"} 
            onClick={() => setFilter("all")}
          >
            All Markets
          </FilterButton>
          <FilterButton 
            active={filter === "discrepancies"} 
            onClick={() => setFilter("discrepancies")}
            highlight
          >
            Discrepancies Only
          </FilterButton>
          {categories.map((category) => (
            <FilterButton
              key={category}
              active={filter === category.toLowerCase()}
              onClick={() => setFilter(category.toLowerCase())}
            >
              {category}
            </FilterButton>
          ))}
        </div>

        {/* Market Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event, index) => (
            <MarketCard key={event.id} event={event} index={index} />
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500">No markets match the current filter.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function FilterButton({
  children,
  active,
  onClick,
  highlight = false,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
        active
          ? highlight
            ? "bg-accent text-surface"
            : "bg-zinc-800 text-zinc-100"
          : highlight
            ? "bg-accent/10 text-accent hover:bg-accent/20"
            : "bg-surface-elevated text-zinc-400 hover:text-zinc-200 border border-surface-border"
      }`}
    >
      {children}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400 text-sm">Loading market data...</p>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 bg-negative/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-negative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-2">Failed to load data</h2>
        <p className="text-sm text-zinc-400 mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-accent text-surface text-sm font-medium rounded-lg hover:bg-accent-muted transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <p className="text-zinc-400">No market data available.</p>
      </div>
    </div>
  );
}

