import axios from "axios";
import type { NormalizedMarket, KalshiMarket } from "@/lib/types";

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

interface KalshiMarketsResponse {
  markets: KalshiMarket[];
  cursor?: string;
}

export class KalshiService {
  private client = axios.create({
    baseURL: KALSHI_API,
    timeout: 10000,
  });

  /**
   * Fetch active markets from Kalshi
   */
  async fetchMarkets(limit = 50): Promise<NormalizedMarket[]> {
    try {
      const response = await this.client.get<KalshiMarketsResponse>("/markets", {
        params: {
          limit,
          status: "open",
        },
      });

      return response.data.markets
        .filter((market) => market.status === "open")
        .map((market) => this.normalizeMarket(market));
    } catch (error) {
      console.error("[Kalshi] Failed to fetch markets:", error);
      return [];
    }
  }

  /**
   * Fetch a specific market by ticker
   */
  async fetchMarketByTicker(ticker: string): Promise<NormalizedMarket | null> {
    try {
      const response = await this.client.get<{ market: KalshiMarket }>(`/markets/${ticker}`);
      return this.normalizeMarket(response.data.market);
    } catch (error) {
      console.error(`[Kalshi] Failed to fetch market ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Normalize Kalshi market to our standard schema
   */
  private normalizeMarket(market: KalshiMarket): NormalizedMarket {
    // Kalshi prices are in cents (0-100), convert to probability (0-1)
    const midYes = (market.yes_bid + market.yes_ask) / 2 / 100;
    const midNo = (market.no_bid + market.no_ask) / 2 / 100;

    return {
      externalId: market.ticker,
      platform: "KALSHI",
      question: market.title,
      description: market.subtitle,
      category: this.normalizeCategory(market.category),
      yesProbability: midYes,
      noProbability: midNo,
      volume: market.volume,
      liquidity: market.open_interest,
      endDate: market.close_time ? new Date(market.close_time) : undefined,
      lastUpdated: new Date(),
    };
  }

  /**
   * Normalize category names for cross-platform matching
   */
  private normalizeCategory(category: string): string {
    const categoryMap: Record<string, string> = {
      politics: "Politics",
      financials: "Economics",
      economics: "Economics",
      climate: "Science",
      science: "Science",
      tech: "Tech",
      entertainment: "Entertainment",
      sports: "Sports",
    };
    
    const lower = category?.toLowerCase() ?? "other";
    return categoryMap[lower] ?? category ?? "Other";
  }
}

export const kalshiService = new KalshiService();

