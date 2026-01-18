/**
 * Execution Price Engine
 * 
 * Core logic for simulating realistic trade execution on Polymarket.
 * 
 * KEY PRINCIPLE: We walk the order book level-by-level to compute
 * the ACTUAL price a trade would execute at, NOT the midpoint price.
 * 
 * This matches how Polymarket's trade ticket calculates prices.
 */

import type {
  OrderBook,
  OrderBookLevel,
  TradeInput,
  ExecutionResult,
  OrderBookAnalysis,
  TradeSide,
} from "@/lib/execution-types";

/**
 * Calculate the execution price for a hypothetical trade
 * 
 * This is the core function of the execution engine. It:
 * 1. Identifies which side of the book to consume (asks for BUY, bids for SELL)
 * 2. Walks through price levels until the order is filled
 * 3. Computes weighted average price and slippage
 * 
 * @param orderBook - The current order book
 * @param input - Trade parameters (side, size)
 * @returns Detailed execution result
 */
export function calculateExecutionPrice(
  orderBook: OrderBook,
  input: TradeInput
): ExecutionResult {
  const { side, outcome, size } = input;

  // For a BUY order, we consume ASKs (offers to sell)
  // For a SELL order, we consume BIDs (offers to buy)
  //
  // Think of it this way:
  // - I want to BUY → I need someone willing to SELL → I hit the asks
  // - I want to SELL → I need someone willing to BUY → I hit the bids
  const levels: OrderBookLevel[] = side === "BUY" 
    ? [...orderBook.asks]  // Sorted ascending (best ask first)
    : [...orderBook.bids]; // Sorted descending (best bid first)

  // If no liquidity on this side, return empty result
  if (levels.length === 0) {
    return createEmptyResult(input);
  }

  // Track execution as we walk the book
  let remainingSize = size;
  let totalCost = 0;
  let filledSize = 0;
  const fills: ExecutionResult["fills"] = [];

  // The best price is the first level we'll hit
  const bestPrice = levels[0].price;
  let worstPrice = bestPrice;

  // Walk through each price level until order is filled
  for (const level of levels) {
    if (remainingSize <= 0) break;

    // How much can we fill at this level?
    const fillAtLevel = Math.min(remainingSize, level.size);

    if (fillAtLevel > 0) {
      // For BUY: we pay price * size
      // For SELL: we receive price * size
      const costAtLevel = fillAtLevel * level.price;

      totalCost += costAtLevel;
      filledSize += fillAtLevel;
      remainingSize -= fillAtLevel;
      worstPrice = level.price;

      fills.push({
        price: level.price,
        size: fillAtLevel,
        cumulative: filledSize,
      });
    }
  }

  // Calculate weighted average execution price
  // avgPrice = totalCost / filledSize
  const averagePrice = filledSize > 0 ? totalCost / filledSize : 0;

  // Calculate slippage from best price
  // For BUY: slippage is positive when we pay MORE than best ask
  // For SELL: slippage is positive when we receive LESS than best bid
  //
  // In both cases: slippage = |avgPrice - bestPrice|
  // But we express it directionally:
  // - BUY slippage: avgPrice - bestPrice (we paid more)
  // - SELL slippage: bestPrice - avgPrice (we received less)
  const slippageFromBest = side === "BUY"
    ? averagePrice - bestPrice
    : bestPrice - averagePrice;

  const slippagePercent = bestPrice > 0 
    ? (slippageFromBest / bestPrice) * 100 
    : 0;

  return {
    // Echo input
    side,
    outcome,
    requestedSize: size,

    // Execution details
    filledSize,
    averagePrice,
    totalCost,

    // Price reference points
    bestPrice,
    worstPrice,

    // Slippage
    slippageFromBest,
    slippagePercent,

    // Fill breakdown
    fills,

    // Partial fill detection
    partialFill: remainingSize > 0,
    remainingSize,
  };
}

/**
 * Create an empty result for when there's no liquidity
 */
function createEmptyResult(input: TradeInput): ExecutionResult {
  return {
    side: input.side,
    outcome: input.outcome,
    requestedSize: input.size,
    filledSize: 0,
    averagePrice: 0,
    totalCost: 0,
    bestPrice: 0,
    worstPrice: 0,
    slippageFromBest: 0,
    slippagePercent: 0,
    fills: [],
    partialFill: true,
    remainingSize: input.size,
  };
}

/**
 * Analyze order book health and characteristics
 * 
 * Provides signals about market quality:
 * - Spread width (tighter = more efficient)
 * - Depth (more = harder to move price)
 * - Imbalance (asymmetry may signal directional pressure)
 */
export function analyzeOrderBook(orderBook: OrderBook): OrderBookAnalysis {
  const { bids, asks } = orderBook;

  // Best prices
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 1;
  const spread = bestAsk - bestBid;
  const midpoint = (bestBid + bestAsk) / 2;

  // Total depth on each side
  const bidDepthTotal = bids.reduce((sum, level) => sum + level.size, 0);
  const askDepthTotal = asks.reduce((sum, level) => sum + level.size, 0);

  // Depth imbalance: positive means more bids (buy pressure)
  const totalDepth = bidDepthTotal + askDepthTotal;
  const depthImbalance = totalDepth > 0
    ? (bidDepthTotal - askDepthTotal) / totalDepth
    : 0;

  // Calculate size needed to move price by 1%
  // This helps understand how "thick" the book is
  const sizeToMoveBid1Percent = calculateSizeToMovePrice(bids, 0.01, "down");
  const sizeToMoveAsk1Percent = calculateSizeToMovePrice(asks, 0.01, "up");

  // Book quality metrics
  const levelCount = bids.length + asks.length;
  const averageLevelSize = totalDepth / Math.max(levelCount, 1);

  return {
    bestBid,
    bestAsk,
    spread,
    spreadPercent: midpoint > 0 ? (spread / midpoint) * 100 : 0,
    midpoint,
    bidDepthTotal,
    askDepthTotal,
    depthImbalance,
    sizeToMoveBid1Percent,
    sizeToMoveAsk1Percent,
    levelCount,
    averageLevelSize,
  };
}

/**
 * Calculate how many contracts needed to move price by a percentage
 * 
 * @param levels - Order book levels (sorted appropriately)
 * @param percentMove - Target price movement (e.g., 0.01 for 1%)
 * @param direction - "up" for asks, "down" for bids
 */
function calculateSizeToMovePrice(
  levels: OrderBookLevel[],
  percentMove: number,
  direction: "up" | "down"
): number {
  if (levels.length === 0) return 0;

  const startPrice = levels[0].price;
  const targetPrice = direction === "up"
    ? startPrice * (1 + percentMove)
    : startPrice * (1 - percentMove);

  let sizeNeeded = 0;

  for (const level of levels) {
    const priceReached = direction === "up"
      ? level.price >= targetPrice
      : level.price <= targetPrice;

    if (priceReached) {
      break;
    }

    sizeNeeded += level.size;
  }

  return sizeNeeded;
}

/**
 * Find the maximum size that can be traded within a slippage tolerance
 * 
 * Useful for determining "how big can I go before slippage kills me?"
 * 
 * @param orderBook - The order book
 * @param side - BUY or SELL
 * @param maxSlippagePercent - Maximum acceptable slippage (e.g., 1.0 for 1%)
 * @returns Maximum tradeable size within tolerance
 */
export function findMaxSizeWithinSlippage(
  orderBook: OrderBook,
  side: TradeSide,
  maxSlippagePercent: number
): { maxSize: number; priceAtMax: number } {
  const levels = side === "BUY" ? orderBook.asks : orderBook.bids;

  if (levels.length === 0) {
    return { maxSize: 0, priceAtMax: 0 };
  }

  const bestPrice = levels[0].price;
  const maxPriceMove = bestPrice * (maxSlippagePercent / 100);

  // For BUY: we can tolerate price going UP by maxPriceMove
  // For SELL: we can tolerate price going DOWN by maxPriceMove
  const priceThreshold = side === "BUY"
    ? bestPrice + maxPriceMove
    : bestPrice - maxPriceMove;

  let cumulativeSize = 0;
  let lastPrice = bestPrice;

  for (const level of levels) {
    // Check if this level exceeds our tolerance
    const exceedsThreshold = side === "BUY"
      ? level.price > priceThreshold
      : level.price < priceThreshold;

    if (exceedsThreshold) {
      break;
    }

    cumulativeSize += level.size;
    lastPrice = level.price;
  }

  return {
    maxSize: cumulativeSize,
    priceAtMax: lastPrice,
  };
}

/**
 * Calculate the execution price for a specific size (convenience function)
 * 
 * @param orderBook - The order book
 * @param side - BUY or SELL
 * @param size - Number of contracts
 * @returns Average execution price
 */
export function getExecutionPrice(
  orderBook: OrderBook,
  side: TradeSide,
  size: number
): number {
  const result = calculateExecutionPrice(orderBook, {
    side,
    outcome: "YES", // Outcome doesn't affect price calculation
    size,
  });

  return result.averagePrice;
}

/**
 * Compare execution prices at different sizes
 * 
 * Useful for visualizing how price deteriorates with size
 */
export function getExecutionPriceAtSizes(
  orderBook: OrderBook,
  side: TradeSide,
  sizes: number[]
): Array<{ size: number; price: number; slippagePercent: number }> {
  return sizes.map((size) => {
    const result = calculateExecutionPrice(orderBook, {
      side,
      outcome: "YES",
      size,
    });

    return {
      size,
      price: result.averagePrice,
      slippagePercent: result.slippagePercent,
    };
  });
}
