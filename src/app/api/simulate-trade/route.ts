/**
 * POST /api/simulate-trade
 * 
 * Simulate trade execution on a Polymarket order book
 */

import { NextRequest, NextResponse } from "next/server";
import { clobClient } from "@/services/clob-client";
import { calculateExecutionPrice } from "@/services/execution-engine";
import { calculatePayoff } from "@/services/payoff-calculator";
import type { TradeInput } from "@/lib/execution-types";

interface SimulateTradeRequest {
  marketId: string;
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  size: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SimulateTradeRequest = await request.json();

    // Validate input
    if (!body.marketId || !body.side || !body.outcome || !body.size) {
      return NextResponse.json(
        { error: "Missing required fields: marketId, side, outcome, size" },
        { status: 400 }
      );
    }

    if (body.size <= 0) {
      return NextResponse.json(
        { error: "Size must be positive" },
        { status: 400 }
      );
    }

    // Fetch order books
    const orderBooks = await clobClient.fetchMarketOrderBooks(body.marketId);

    // Select the right order book based on outcome
    const orderBook = body.outcome === "YES" ? orderBooks.yes : orderBooks.no;

    // Create trade input
    const tradeInput: TradeInput = {
      side: body.side,
      outcome: body.outcome,
      size: body.size,
    };

    // Calculate execution
    const execution = calculateExecutionPrice(orderBook, tradeInput);

    // Calculate payoff
    const payoff = calculatePayoff(execution);

    return NextResponse.json({
      marketId: body.marketId,
      question: orderBooks.question,
      execution: {
        ...execution,
        // Add formatted values for display
        formattedAvgPrice: `$${execution.averagePrice.toFixed(4)}`,
        formattedTotalCost: `$${execution.totalCost.toFixed(2)}`,
        formattedSlippage: `${execution.slippagePercent.toFixed(2)}%`,
      },
      payoff: {
        ...payoff,
        // Add formatted values
        formattedPnlIfYes: `$${payoff.pnlIfYes.toFixed(2)}`,
        formattedPnlIfNo: `$${payoff.pnlIfNo.toFixed(2)}`,
        formattedReturnIfYes: `${payoff.returnIfYes.toFixed(1)}%`,
        formattedReturnIfNo: `${payoff.returnIfNo.toFixed(1)}%`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Failed to simulate trade:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to simulate trade" },
      { status: 500 }
    );
  }
}
