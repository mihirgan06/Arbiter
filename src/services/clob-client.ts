/**
 * Polymarket CLOB (Central Limit Order Book) Client
 * 
 * Fetches live order book data from Polymarket's CLOB API.
 * This is the foundation for execution-aware analytics.
 */

import axios, { AxiosInstance } from "axios";
import type { OrderBook, OrderBookLevel, MarketOrderBooks } from "@/lib/execution-types";

// CLOB API response types
interface CLOBOrderBookResponse {
  market: string;
  asset_id: string;
  hash: string;
  timestamp: string;
  bids: Array<{
    price: string;
    size: string;
  }>;
  asks: Array<{
    price: string;
    size: string;
  }>;
}

interface CLOBMarketResponse {
  condition_id: string;
  question_id: string;
  tokens: Array<{
    token_id: string;
    outcome: string;
    winner: boolean;
  }>;
  rewards: {
    rates: Array<{
      asset_address: string;
      rewards_daily_rate: number;
    }>;
    min_size: number;
    max_spread: number;
  };
  minimum_order_size: string;
  minimum_tick_size: string;
  description: string;
  category: string;
  end_date_iso: string;
  game_start_time: string;
  question: string;
  market_slug: string;
  min_incentive_size: string;
  max_incentive_spread: string;
  active: boolean;
  closed: boolean;
  seconds_delay: number;
  icon: string;
  fpmm: string;
  enable_order_book: boolean;
}

export class PolymarketCLOBClient {
  private client: AxiosInstance;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    const baseURL = process.env.POLYMARKET_CLOB_API || "https://clob.polymarket.com";
    this.apiKey = process.env.POLYMARKET_API_KEY || "";
    this.apiSecret = process.env.POLYMARKET_API_SECRET || "";

    this.client = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Fetch order book for a specific token (YES or NO outcome)
   * 
   * @param tokenId - The token ID for the outcome
   * @returns Normalized order book
   */
  async fetchOrderBook(tokenId: string): Promise<OrderBook> {
    try {
      const response = await this.client.get<CLOBOrderBookResponse>("/book", {
        params: {
          token_id: tokenId,
        },
      });

      const data = response.data;

      // Parse and sort bids (descending - best bid first)
      const bids: OrderBookLevel[] = data.bids
        .map((bid) => ({
          price: parseFloat(bid.price),
          size: parseFloat(bid.size),
        }))
        .filter((bid) => bid.size > 0)
        .sort((a, b) => b.price - a.price);

      // Parse and sort asks (ascending - best ask first)
      const asks: OrderBookLevel[] = data.asks
        .map((ask) => ({
          price: parseFloat(ask.price),
          size: parseFloat(ask.size),
        }))
        .filter((ask) => ask.size > 0)
        .sort((a, b) => a.price - b.price);

      return {
        bids,
        asks,
        timestamp: new Date(data.timestamp),
        tokenId: data.asset_id,
        marketId: data.market,
      };
    } catch (error) {
      console.error(`[CLOB] Failed to fetch order book for token ${tokenId}:`, error);
      throw new Error(`Failed to fetch order book: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Fetch market metadata to get token IDs for YES and NO outcomes
   * 
   * @param conditionId - The market condition ID
   * @returns Market metadata including token IDs
   */
  async fetchMarket(conditionId: string): Promise<CLOBMarketResponse> {
    try {
      const response = await this.client.get<CLOBMarketResponse>(`/markets/${conditionId}`);
      return response.data;
    } catch (error) {
      console.error(`[CLOB] Failed to fetch market ${conditionId}:`, error);
      throw new Error(`Failed to fetch market: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Fetch order books for both YES and NO outcomes of a market
   * 
   * @param conditionId - The market condition ID
   * @returns Order books for both outcomes
   */
  async fetchMarketOrderBooks(conditionId: string): Promise<MarketOrderBooks> {
    // First, get market metadata to find token IDs
    const market = await this.fetchMarket(conditionId);

    const yesToken = market.tokens.find((t) => t.outcome === "Yes");
    const noToken = market.tokens.find((t) => t.outcome === "No");

    if (!yesToken || !noToken) {
      throw new Error(`Market ${conditionId} does not have YES/NO outcomes`);
    }

    // Fetch both order books in parallel
    const [yesBook, noBook] = await Promise.all([
      this.fetchOrderBook(yesToken.token_id),
      this.fetchOrderBook(noToken.token_id),
    ]);

    return {
      marketId: conditionId,
      question: market.question,
      yes: yesBook,
      no: noBook,
      fetchedAt: new Date(),
    };
  }

  /**
   * Search for markets by query string
   * 
   * @param query - Search query
   * @param limit - Max results
   * @returns Array of markets
   */
  async searchMarkets(query: string, limit = 10): Promise<CLOBMarketResponse[]> {
    try {
      const response = await this.client.get<CLOBMarketResponse[]>("/markets", {
        params: {
          next_cursor: "MA==", // Start from beginning
        },
      });

      // Filter by query (case-insensitive)
      const lowerQuery = query.toLowerCase();
      return response.data
        .filter((m) => 
          m.question.toLowerCase().includes(lowerQuery) ||
          m.description?.toLowerCase().includes(lowerQuery)
        )
        .slice(0, limit);
    } catch (error) {
      console.error(`[CLOB] Failed to search markets:`, error);
      return [];
    }
  }

  /**
   * Get the best bid and ask prices for quick reference
   * (For detailed analysis, use fetchOrderBook instead)
   */
  async getTopOfBook(tokenId: string): Promise<{ bestBid: number; bestAsk: number; spread: number } | null> {
    try {
      const book = await this.fetchOrderBook(tokenId);
      
      const bestBid = book.bids[0]?.price ?? 0;
      const bestAsk = book.asks[0]?.price ?? 1;
      
      return {
        bestBid,
        bestAsk,
        spread: bestAsk - bestBid,
      };
    } catch {
      return null;
    }
  }
}

// Singleton export
export const clobClient = new PolymarketCLOBClient();
