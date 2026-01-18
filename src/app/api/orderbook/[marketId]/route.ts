/**
 * GET /api/orderbook/:marketId
 * 
 * Fetch order book for a Polymarket market
 */

import { NextRequest, NextResponse } from "next/server";
import { clobClient } from "@/services/clob-client";
import { analyzeOrderBook } from "@/services/execution-engine";

export async function GET(
  request: NextRequest,
  { params }: { params: { marketId: string } }
) {
  try {
    const { marketId } = params;

    if (!marketId) {
      return NextResponse.json(
        { error: "Market ID is required" },
        { status: 400 }
      );
    }

    // Fetch order books for both YES and NO
    const orderBooks = await clobClient.fetchMarketOrderBooks(marketId);

    // Analyze both books
    const yesAnalysis = analyzeOrderBook(orderBooks.yes);
    const noAnalysis = analyzeOrderBook(orderBooks.no);

    return NextResponse.json({
      marketId: orderBooks.marketId,
      question: orderBooks.question,
      fetchedAt: orderBooks.fetchedAt.toISOString(),
      yes: {
        bids: orderBooks.yes.bids,
        asks: orderBooks.yes.asks,
        analysis: yesAnalysis,
      },
      no: {
        bids: orderBooks.no.bids,
        asks: orderBooks.no.asks,
        analysis: noAnalysis,
      },
    });
  } catch (error) {
    console.error("[API] Failed to fetch order book:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch order book" },
      { status: 500 }
    );
  }
}
