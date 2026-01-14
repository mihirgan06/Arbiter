import { z } from "zod";

// Platform enum matching Prisma
export const Platform = {
  POLYMARKET: "POLYMARKET",
  KALSHI: "KALSHI",
  PREDICTIT: "PREDICTIT",
  METACULUS: "METACULUS",
} as const;

export type Platform = (typeof Platform)[keyof typeof Platform];

// Normalized market data schema
export const NormalizedMarketSchema = z.object({
  externalId: z.string(),
  platform: z.enum(["POLYMARKET", "KALSHI", "PREDICTIT", "METACULUS"]),
  question: z.string(),
  description: z.string().optional(),
  category: z.string(),
  yesProbability: z.number().min(0).max(1),
  noProbability: z.number().min(0).max(1),
  volume: z.number().optional(),
  liquidity: z.number().optional(),
  endDate: z.date().optional(),
  lastUpdated: z.date(),
});

export type NormalizedMarket = z.infer<typeof NormalizedMarketSchema>;

// Discrepancy detection result
export interface DiscrepancyResult {
  eventSlug: string;
  eventTitle: string;
  markets: {
    platform: Platform;
    yesProbability: number;
    volume?: number;
    liquidity?: number;
  }[];
  maxSpread: number;
  spreadPercent: number;
  confidence: number;
  likelyDrivers: NewsCorrelation[];
}

// News correlation with market movement
export interface NewsCorrelation {
  title: string;
  source: string;
  url: string;
  publishedAt: Date;
  sentiment: number;
  relevanceScore: number;
  priceMovement?: {
    platform: Platform;
    beforePrice: number;
    afterPrice: number;
    change: number;
  };
}

// API response types for external services
export interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  outcomes: string[];
  outcomePrices: string[];
  volume: number;
  liquidity: number;
  endDate: string;
  category: string;
  active: boolean;
}

export interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  volume: number;
  open_interest: number;
  close_time: string;
  category: string;
  status: string;
}

// Dashboard display types
export interface DashboardEvent {
  id: string;
  slug: string;
  title: string;
  category: string;
  markets: DashboardMarket[];
  discrepancy?: {
    spread: number;
    spreadPercent: number;
    confidence: number;
  };
  recentNews: {
    title: string;
    source: string;
    url: string;
    publishedAt: string;
    relevance: number;
  }[];
}

export interface DashboardMarket {
  platform: Platform;
  yesProbability: number;
  noProbability: number;
  volume?: number;
  liquidity?: number;
  isBestYes: boolean;
  isBestNo: boolean;
  lastUpdated: string;
}

