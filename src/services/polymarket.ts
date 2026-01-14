import axios from "axios";
import type { NormalizedMarket, PolymarketEvent } from "@/lib/types";

const POLYMARKET_API = "https://gamma-api.polymarket.com";

interface PolymarketEventsResponse {
  data: PolymarketEvent[];
  next_cursor?: string;
}

export class PolymarketService {
  private client = axios.create({
    baseURL: POLYMARKET_API,
    timeout: 10000,
  });

  /**
   * Fetch active markets from Polymarket
   */
  async fetchMarkets(limit = 50): Promise<NormalizedMarket[]> {
    try {
      const response = await this.client.get<PolymarketEventsResponse>("/events", {
        params: {
          limit,
          active: true,
          closed: false,
          order: "volume",
          ascending: false,
        },
      });

      return response.data.data
        .filter((event) => event.active && event.outcomePrices?.length >= 2)
        .map((event) => this.normalizeEvent(event));
    } catch (error) {
      console.error("[Polymarket] Failed to fetch markets:", error);
      return [];
    }
  }

  /**
   * Fetch a specific market by slug
   */
  async fetchMarketBySlug(slug: string): Promise<NormalizedMarket | null> {
    try {
      const response = await this.client.get<PolymarketEvent>(`/events/${slug}`);
      return this.normalizeEvent(response.data);
    } catch (error) {
      console.error(`[Polymarket] Failed to fetch market ${slug}:`, error);
      return null;
    }
  }

  /**
   * Normalize Polymarket event to our standard schema
   */
  private normalizeEvent(event: PolymarketEvent): NormalizedMarket {
    // Polymarket prices are strings like "0.42" representing probability
    const yesPriceStr = event.outcomePrices?.[0] ?? "0.5";
    const noPriceStr = event.outcomePrices?.[1] ?? "0.5";
    
    const yesProb = parseFloat(yesPriceStr);
    const noProb = parseFloat(noPriceStr);

    return {
      externalId: event.id,
      platform: "POLYMARKET",
      question: event.title,
      description: event.description,
      category: this.normalizeCategory(event.category),
      yesProbability: yesProb,
      noProbability: noProb,
      volume: event.volume,
      liquidity: event.liquidity,
      endDate: event.endDate ? new Date(event.endDate) : undefined,
      lastUpdated: new Date(),
    };
  }

  /**
   * Normalize category names for cross-platform matching
   */
  private normalizeCategory(category: string): string {
    const categoryMap: Record<string, string> = {
      politics: "Politics",
      crypto: "Crypto",
      sports: "Sports",
      science: "Science",
      entertainment: "Entertainment",
      business: "Business",
      economics: "Economics",
      tech: "Tech",
    };
    
    const lower = category?.toLowerCase() ?? "other";
    return categoryMap[lower] ?? category ?? "Other";
  }
}

export const polymarketService = new PolymarketService();

