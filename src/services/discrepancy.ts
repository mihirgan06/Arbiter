import type { NormalizedMarket, DiscrepancyResult, Platform } from "@/lib/types";
import { newsService } from "./news";

interface MarketGroup {
  eventSlug: string;
  eventTitle: string;
  markets: NormalizedMarket[];
}

export class DiscrepancyEngine {
  private readonly MIN_SPREAD_THRESHOLD = 0.03; // 3% minimum spread
  private readonly HIGH_CONFIDENCE_THRESHOLD = 0.05; // 5% for high confidence

  /**
   * Detect discrepancies across all markets
   */
  async detectDiscrepancies(markets: NormalizedMarket[]): Promise<DiscrepancyResult[]> {
    // Group markets by similar questions (simplified matching)
    const groups = this.groupSimilarMarkets(markets);
    
    const discrepancies: DiscrepancyResult[] = [];

    for (const group of groups) {
      if (group.markets.length < 2) continue;

      const analysis = await this.analyzeGroup(group);
      if (analysis && analysis.maxSpread >= this.MIN_SPREAD_THRESHOLD) {
        discrepancies.push(analysis);
      }
    }

    // Sort by spread (highest first)
    return discrepancies.sort((a, b) => b.maxSpread - a.maxSpread);
  }

  /**
   * Group markets by similar questions across platforms
   */
  private groupSimilarMarkets(markets: NormalizedMarket[]): MarketGroup[] {
    const groups = new Map<string, MarketGroup>();

    for (const market of markets) {
      const slug = this.generateSlug(market.question);
      
      if (!groups.has(slug)) {
        groups.set(slug, {
          eventSlug: slug,
          eventTitle: market.question,
          markets: [],
        });
      }

      groups.get(slug)!.markets.push(market);
    }

    return Array.from(groups.values()).filter((g) => g.markets.length > 1);
  }

  /**
   * Generate a normalized slug for matching similar questions
   */
  private generateSlug(question: string): string {
    // Extract key terms and create a matchable slug
    return question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(" ")
      .filter((w) => w.length > 3)
      .sort()
      .join("-")
      .substring(0, 100);
  }

  /**
   * Analyze a group of markets for discrepancies
   */
  private async analyzeGroup(group: MarketGroup): Promise<DiscrepancyResult | null> {
    const { markets } = group;

    // Find min and max YES probabilities
    const yesPrices = markets.map((m) => m.yesProbability);
    const minYes = Math.min(...yesPrices);
    const maxYes = Math.max(...yesPrices);
    const spread = maxYes - minYes;

    if (spread < this.MIN_SPREAD_THRESHOLD) {
      return null;
    }

    // Calculate confidence based on spread and liquidity
    const confidence = this.calculateConfidence(markets, spread);

    // Fetch correlated news
    const news = await newsService.searchNews(group.eventTitle);

    return {
      eventSlug: group.eventSlug,
      eventTitle: group.eventTitle,
      markets: markets.map((m) => ({
        platform: m.platform as Platform,
        yesProbability: m.yesProbability,
        volume: m.volume,
        liquidity: m.liquidity,
      })),
      maxSpread: spread,
      spreadPercent: (spread / ((maxYes + minYes) / 2)) * 100,
      confidence,
      likelyDrivers: news.slice(0, 3),
    };
  }

  /**
   * Calculate confidence score for a discrepancy
   * Higher confidence = more likely to be a real opportunity
   */
  private calculateConfidence(markets: NormalizedMarket[], spread: number): number {
    let confidence = 0;

    // Base confidence from spread size
    if (spread >= this.HIGH_CONFIDENCE_THRESHOLD) {
      confidence += 0.4;
    } else if (spread >= this.MIN_SPREAD_THRESHOLD) {
      confidence += 0.2;
    }

    // Bonus for having liquidity data
    const marketsWithLiquidity = markets.filter((m) => m.liquidity && m.liquidity > 0);
    if (marketsWithLiquidity.length === markets.length) {
      confidence += 0.2;
      
      // Bonus for high liquidity
      const avgLiquidity =
        marketsWithLiquidity.reduce((sum, m) => sum + (m.liquidity || 0), 0) /
        marketsWithLiquidity.length;
      
      if (avgLiquidity > 100000) confidence += 0.2;
      else if (avgLiquidity > 10000) confidence += 0.1;
    }

    // Bonus for high volume
    const marketsWithVolume = markets.filter((m) => m.volume && m.volume > 0);
    if (marketsWithVolume.length > 0) {
      const avgVolume =
        marketsWithVolume.reduce((sum, m) => sum + (m.volume || 0), 0) /
        marketsWithVolume.length;
      
      if (avgVolume > 1000000) confidence += 0.2;
      else if (avgVolume > 100000) confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  /**
   * Calculate potential arbitrage opportunity (for display only)
   * This assumes you could buy YES on low platform and NO on high platform
   */
  calculateArbitrageOpportunity(
    lowYesPrice: number,
    highYesPrice: number,
    lowLiquidity?: number,
    highLiquidity?: number
  ): { exists: boolean; theoreticalReturn: number; confidence: number } {
    const lowNoPrice = 1 - lowYesPrice;
    const highNoPrice = 1 - highYesPrice;

    // Cost to buy YES on low platform + NO on high platform
    const totalCost = lowYesPrice + highNoPrice;

    // If total cost < 1, there's a theoretical arbitrage
    const exists = totalCost < 1;
    const theoreticalReturn = exists ? (1 - totalCost) * 100 : 0;

    // Adjust confidence based on liquidity
    let confidence = exists ? 0.5 : 0;
    if (exists && lowLiquidity && highLiquidity) {
      const minLiquidity = Math.min(lowLiquidity, highLiquidity);
      if (minLiquidity > 50000) confidence = 0.9;
      else if (minLiquidity > 10000) confidence = 0.7;
    }

    return { exists, theoreticalReturn, confidence };
  }
}

export const discrepancyEngine = new DiscrepancyEngine();

