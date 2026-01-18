"use client";

import { useState } from "react";

interface ExecutionResult {
  marketId: string;
  question: string;
  execution: {
    side: "BUY" | "SELL";
    outcome: "YES" | "NO";
    requestedSize: number;
    filledSize: number;
    averagePrice: number;
    totalCost: number;
    bestPrice: number;
    worstPrice: number;
    slippageFromBest: number;
    slippagePercent: number;
    partialFill: boolean;
    formattedAvgPrice: string;
    formattedTotalCost: string;
    formattedSlippage: string;
    fills: Array<{ price: number; size: number; cumulative: number }>;
  };
  payoff: {
    pnlIfYes: number;
    pnlIfNo: number;
    returnIfYes: number;
    returnIfNo: number;
    maxGain: number;
    maxLoss: number;
    capitalAtRisk: number;
    formattedPnlIfYes: string;
    formattedPnlIfNo: string;
    formattedReturnIfYes: string;
    formattedReturnIfNo: string;
  };
}

export function ExecutionSimulator() {
  const [marketId, setMarketId] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [size, setSize] = useState(100);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async () => {
    if (!marketId.trim()) {
      setError("Please enter a market ID");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/simulate-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, side, outcome, size }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to simulate trade");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-elevated border border-surface-border rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
        <span className="text-2xl">⚡</span>
        Execution Simulator
      </h2>

      <div className="grid gap-4 md:grid-cols-5 mb-4">
        {/* Market ID */}
        <div className="md:col-span-2">
          <label className="block text-xs text-zinc-500 mb-1">Market ID (Condition ID)</label>
          <input
            type="text"
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-surface border border-surface-border rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Side */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Side</label>
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as "BUY" | "SELL")}
            className="w-full px-3 py-2 bg-surface border border-surface-border rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-accent"
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>

        {/* Outcome */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Outcome</label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as "YES" | "NO")}
            className="w-full px-3 py-2 bg-surface border border-surface-border rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-accent"
          >
            <option value="YES">YES</option>
            <option value="NO">NO</option>
          </select>
        </div>

        {/* Size */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Size</label>
          <input
            type="number"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            min={1}
            className="w-full px-3 py-2 bg-surface border border-surface-border rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <button
        onClick={handleSimulate}
        disabled={loading}
        className="w-full md:w-auto px-6 py-2 bg-accent text-surface font-medium rounded-lg hover:bg-accent-muted transition-colors disabled:opacity-50"
      >
        {loading ? "Simulating..." : "Simulate Trade"}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-negative/10 border border-negative/20 rounded-lg">
          <p className="text-sm text-negative">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          {/* Market Info */}
          <div className="p-4 bg-surface rounded-lg border border-surface-border">
            <h3 className="text-sm font-medium text-zinc-400 mb-1">Market</h3>
            <p className="text-zinc-100">{result.question}</p>
          </div>

          {/* Execution Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-surface rounded-lg border border-surface-border">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Execution Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Average Price</span>
                  <span className="text-zinc-100 font-mono">{result.execution.formattedAvgPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Cost</span>
                  <span className="text-zinc-100 font-mono">{result.execution.formattedTotalCost}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Filled Size</span>
                  <span className="text-zinc-100 font-mono">{result.execution.filledSize} / {result.execution.requestedSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Slippage</span>
                  <span className={`font-mono ${result.execution.slippagePercent > 1 ? "text-negative" : "text-positive"}`}>
                    {result.execution.formattedSlippage}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Best → Worst Price</span>
                  <span className="text-zinc-100 font-mono">
                    ${result.execution.bestPrice.toFixed(4)} → ${result.execution.worstPrice.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payoff Analysis */}
            <div className="p-4 bg-surface rounded-lg border border-surface-border">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Resolution Payoff</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">If YES resolves</span>
                  <span className={`font-mono ${result.payoff.pnlIfYes >= 0 ? "text-positive" : "text-negative"}`}>
                    {result.payoff.formattedPnlIfYes} ({result.payoff.formattedReturnIfYes})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">If NO resolves</span>
                  <span className={`font-mono ${result.payoff.pnlIfNo >= 0 ? "text-positive" : "text-negative"}`}>
                    {result.payoff.formattedPnlIfNo} ({result.payoff.formattedReturnIfNo})
                  </span>
                </div>
                <div className="pt-2 border-t border-surface-border">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Max Gain</span>
                    <span className="text-positive font-mono">${result.payoff.maxGain.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Max Loss</span>
                    <span className="text-negative font-mono">${result.payoff.maxLoss.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Capital at Risk</span>
                    <span className="text-zinc-100 font-mono">${result.payoff.capitalAtRisk.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fill Breakdown */}
          {result.execution.fills.length > 0 && (
            <div className="p-4 bg-surface rounded-lg border border-surface-border">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Fill Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 border-b border-surface-border">
                      <th className="text-left py-2">Level</th>
                      <th className="text-right py-2">Price</th>
                      <th className="text-right py-2">Size</th>
                      <th className="text-right py-2">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.execution.fills.map((fill, i) => (
                      <tr key={i} className="border-b border-surface-border/50">
                        <td className="py-2 text-zinc-400">{i + 1}</td>
                        <td className="py-2 text-right font-mono text-zinc-100">${fill.price.toFixed(4)}</td>
                        <td className="py-2 text-right font-mono text-zinc-100">{fill.size.toFixed(2)}</td>
                        <td className="py-2 text-right font-mono text-zinc-400">{fill.cumulative.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
