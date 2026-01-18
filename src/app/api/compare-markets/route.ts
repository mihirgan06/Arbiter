/**
 * POST /api/compare-markets
 * 
 * Compare two markets for inefficiencies and arbitrage opportunities
 */

import { NextRequest, NextResponse } from "next/server";
import { clobClient } from "@/services/clob-client";
import { compareMarkets, analyzeMarketEfficiency } from "@/services/arbitrage-analyzer";

interface CompareMarketsRequest {
  marketIdA: string;
  marketIdB: string;
  tradeSize: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: CompareMarketsRequest = await request.json();

    // Validate input
    if (!body.marketIdA || !body.marketIdB) {
      return NextResponse.json(
        { error: "Missing required fields: marketIdA, marketIdB" },
        { status: 400 }
      );
    }

    const tradeSize = body.tradeSize || 100;

    // Fetch both markets in parallel
    const [marketA, marketB] = await Promise.all([
      clobClient.fetchMarketOrderBooks(body.marketIdA),
      clobClient.fetchMarketOrderBooks(body.marketIdB),
    ]);

    // Compare markets
    const comparison = compareMarkets(marketA, marketB, tradeSize);

    // Also analyze each market's individual efficiency
    const efficiencyA = analyzeMarketEfficiency(marketA, tradeSize);
    const efficiencyB = analyzeMarketEfficiency(marketB, tradeSize);

    return NextResponse.json({
      comparison,
      efficiencyA: {
        marketId: body.marketIdA,
        question: marketA.question,
        ...efficiencyA,
      },
      efficiencyB: {
        marketId: body.marketIdB,
        question: marketB.question,
        ...efficiencyB,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Failed to compare markets:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compare markets" },
      { status: 500 }
    );
  }
}
