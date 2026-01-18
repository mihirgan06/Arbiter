/**
 * Cross-Market Arbitrage Analyzer
 * 
 * Detects execution-aware inefficiencies between related Polymarket markets.
 * 
 * IMPORTANT: This is NOT risk-free arbitrage detection. True arbitrage is rare.
 * This analyzer finds:
 * - Price discrepancies that may represent inefficiencies
 * - Dominance violations (logical inconsistencies)
 * - Maximum viable trade sizes before slippage kills any edge
 * 
 * All analysis uses EXECUTION-AWARE prices, not midpoints.
 */

import type {
  OrderBook,
  MarketOrderBooks,
  MarketComparisonResult,
  ExecutionResult,
} from "@/lib/execution-types";
import { calculateExecutionPrice, analyzeOrderBook, findMaxSizeWithinSlippage } from "./execution-engine";

/**
 * Compare two markets for inefficiencies
 * 
 * Use cases:
 * 1. Same event on different time horizons (e.g., "Trump wins 2024" vs "GOP wins 2024")
 * 2. Conditional relationships (e.g., "A happens" vs "A happens given B")
 * 3. Complementary markets that should sum to ~100%
 * 
 * @param marketA - First market's order books
 * @param marketB - Second market's order books
 * @param tradeSize - Size to simulate for price comparison
 */
export function compareMarkets(
  marketA: MarketOrderBooks,
  marketB: MarketOrderBooks,
  tradeSize: number
): MarketComparisonResult {
  // Analyze individual order books
  const analysisAYes = analyzeOrderBook(marketA.yes);
  const analysisANo = analyzeOrderBook(marketA.no);
  const analysisBYes = analyzeOrderBook(marketB.yes);
  const analysisBNo = analyzeOrderBook(marketB.no);

  // Get execution prices at the requested size
  // We simulate BUY side because that's the "entry" price
  const execAYes = calculateExecutionPrice(marketA.yes, { side: "BUY", outcome: "YES", size: tradeSize });
  const execANo = calculateExecutionPrice(marketA.no, { side: "BUY", outcome: "NO", size: tradeSize });
  const execBYes = calculateExecutionPrice(marketB.yes, { side: "BUY", outcome: "YES", size: tradeSize });
  const execBNo = calculateExecutionPrice(marketB.no, { side: "BUY", outcome: "NO", size: tradeSize });

  // Price differences (positive means A is higher than B)
  const priceDifferenceYes = execAYes.averagePrice - execBYes.averagePrice;
  const priceDifferenceNo = execANo.averagePrice - execBNo.averagePrice;

  // Check for apparent arbitrage opportunities
  // This is a simplified check - true arbitrage analysis requires understanding
  // the relationship between the markets
  const { hasArbitrage, arbitrageEdge, arbitrageDetails } = detectApparentArbitrage(
    execAYes,
    execANo,
    execBYes,
    execBNo
  );

  // Check for dominance violations
  const dominanceCheck = checkDominanceViolations(
    marketA,
    marketB,
    execAYes,
    execANo,
    execBYes,
    execBNo
  );

  // Find max viable size (where edge disappears due to slippage)
  const maxViableSize = findMaxViableArbSize(
    marketA,
    marketB,
    hasArbitrage ? Math.abs(arbitrageEdge) : 0
  );

  // Combined slippage at requested size
  const totalSlippage = 
    execAYes.slippagePercent + 
    execANo.slippagePercent +
    execBYes.slippagePercent + 
    execBNo.slippagePercent;

  // Generate risk signals
  const riskSignals = generateRiskSignals(
    analysisAYes,
    analysisANo,
    analysisBYes,
    analysisBNo,
    tradeSize
  );

  return {
    marketA: {
      marketId: marketA.marketId,
      question: marketA.question,
      executionPriceYes: execAYes.averagePrice,
      executionPriceNo: execANo.averagePrice,
      spreadWidth: analysisAYes.spread,
      depthAtSize: Math.min(
        execAYes.filledSize,
        execANo.filledSize
      ),
    },
    marketB: {
      marketId: marketB.marketId,
      question: marketB.question,
      executionPriceYes: execBYes.averagePrice,
      executionPriceNo: execBNo.averagePrice,
      spreadWidth: analysisBYes.spread,
      depthAtSize: Math.min(
        execBYes.filledSize,
        execBNo.filledSize
      ),
    },
    priceDifferenceYes,
    priceDifferenceNo,
    apparentArbitrage: hasArbitrage,
    arbitrageEdge,
    maxViableSize,
    slippageAtSize: totalSlippage,
    dominanceViolation: dominanceCheck.hasViolation,
    dominanceDetails: dominanceCheck.details,
    riskSignals,
  };
}

/**
 * Detect apparent arbitrage between two binary markets
 * 
 * Classic binary market arbitrage:
 * If you can BUY YES in market A and SELL YES in market B (or equivalent),
 * and the prices create a guaranteed profit, that's arbitrage.
 * 
 * However, this requires the markets to be on the SAME event.
 * For related-but-different events, it's speculation, not arbitrage.
 */
function detectApparentArbitrage(
  execAYes: ExecutionResult,
  execANo: ExecutionResult,
  execBYes: ExecutionResult,
  execBNo: ExecutionResult
): { hasArbitrage: boolean; arbitrageEdge: number; arbitrageDetails: string } {
  // For same-event arbitrage:
  // If A.YES + A.NO < 1, you can buy both and guarantee profit
  // If B.YES + B.NO < 1, same thing
  
  const sumA = execAYes.averagePrice + execANo.averagePrice;
  const sumB = execBYes.averagePrice + execBNo.averagePrice;

  // Check for single-market arbitrage (YES + NO < $1)
  if (sumA < 0.98) { // Allow 2% for fees/spread
    return {
      hasArbitrage: true,
      arbitrageEdge: 1 - sumA,
      arbitrageDetails: `Market A: YES + NO = ${sumA.toFixed(4)} < 1.00 (potential ${((1 - sumA) * 100).toFixed(2)}% edge)`,
    };
  }

  if (sumB < 0.98) {
    return {
      hasArbitrage: true,
      arbitrageEdge: 1 - sumB,
      arbitrageDetails: `Market B: YES + NO = ${sumB.toFixed(4)} < 1.00 (potential ${((1 - sumB) * 100).toFixed(2)}% edge)`,
    };
  }

  // Cross-market check: buy YES in cheaper market, sell YES in expensive
  // This only works if the markets are about the SAME event
  const yesDiff = Math.abs(execAYes.averagePrice - execBYes.averagePrice);
  const noDiff = Math.abs(execANo.averagePrice - execBNo.averagePrice);

  if (yesDiff > 0.05 || noDiff > 0.05) {
    return {
      hasArbitrage: false,
      arbitrageEdge: Math.max(yesDiff, noDiff),
      arbitrageDetails: `Price discrepancy detected: YES diff ${(yesDiff * 100).toFixed(2)}%, NO diff ${(noDiff * 100).toFixed(2)}%. May be inefficiency if markets are related.`,
    };
  }

  return {
    hasArbitrage: false,
    arbitrageEdge: 0,
    arbitrageDetails: "No significant arbitrage opportunity detected",
  };
}

/**
 * Check for dominance violations (logical inconsistencies)
 * 
 * Examples:
 * - If A implies B, then P(A) should be <= P(B)
 * - If A and B are mutually exclusive, P(A) + P(B) should be <= 1
 */
function checkDominanceViolations(
  marketA: MarketOrderBooks,
  marketB: MarketOrderBooks,
  execAYes: ExecutionResult,
  execANo: ExecutionResult,
  execBYes: ExecutionResult,
  execBNo: ExecutionResult
): { hasViolation: boolean; details?: string } {
  // Basic sanity checks
  
  // Check 1: YES + NO should be close to 1 in each market
  const sumA = execAYes.averagePrice + execANo.averagePrice;
  const sumB = execBYes.averagePrice + execBNo.averagePrice;

  if (sumA > 1.05) {
    return {
      hasViolation: true,
      details: `Market A: YES + NO = ${sumA.toFixed(4)} > 1.00 (overpriced by ${((sumA - 1) * 100).toFixed(2)}%)`,
    };
  }

  if (sumB > 1.05) {
    return {
      hasViolation: true,
      details: `Market B: YES + NO = ${sumB.toFixed(4)} > 1.00 (overpriced by ${((sumB - 1) * 100).toFixed(2)}%)`,
    };
  }

  // Check 2: Prices should be between 0 and 1
  const prices = [
    execAYes.averagePrice,
    execANo.averagePrice,
    execBYes.averagePrice,
    execBNo.averagePrice,
  ];

  for (const price of prices) {
    if (price < 0 || price > 1) {
      return {
        hasViolation: true,
        details: `Invalid price detected: ${price.toFixed(4)} (should be between 0 and 1)`,
      };
    }
  }

  return { hasViolation: false };
}

/**
 * Find the maximum size where an arbitrage edge still exists
 * 
 * As trade size increases, slippage eats into the edge.
 * This finds where edge - slippage = 0.
 */
function findMaxViableArbSize(
  marketA: MarketOrderBooks,
  marketB: MarketOrderBooks,
  initialEdge: number
): number {
  if (initialEdge <= 0) return 0;

  // Binary search for max viable size
  let low = 0;
  let high = 10000; // Arbitrary large size
  let maxSize = 0;

  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);

    // Calculate execution at this size
    const execAYes = calculateExecutionPrice(marketA.yes, { side: "BUY", outcome: "YES", size: mid });
    const execBYes = calculateExecutionPrice(marketB.yes, { side: "BUY", outcome: "YES", size: mid });

    // Check if slippage has killed the edge
    const totalSlippage = execAYes.slippagePercent + execBYes.slippagePercent;
    const edgeRemaining = initialEdge * 100 - totalSlippage;

    if (edgeRemaining > 0) {
      maxSize = mid;
      low = mid;
    } else {
      high = mid;
    }
  }

  return maxSize;
}

/**
 * Generate risk signals based on order book analysis
 */
function generateRiskSignals(
  analysisAYes: ReturnType<typeof analyzeOrderBook>,
  analysisANo: ReturnType<typeof analyzeOrderBook>,
  analysisBYes: ReturnType<typeof analyzeOrderBook>,
  analysisBNo: ReturnType<typeof analyzeOrderBook>,
  tradeSize: number
): string[] {
  const signals: string[] = [];

  // Wide spread warning
  const maxSpread = Math.max(
    analysisAYes.spreadPercent,
    analysisANo.spreadPercent,
    analysisBYes.spreadPercent,
    analysisBNo.spreadPercent
  );
  if (maxSpread > 5) {
    signals.push(`Wide spread detected: ${maxSpread.toFixed(2)}% (execution costs may be high)`);
  }

  // Low depth warning
  const minDepth = Math.min(
    analysisAYes.bidDepthTotal + analysisAYes.askDepthTotal,
    analysisANo.bidDepthTotal + analysisANo.askDepthTotal,
    analysisBYes.bidDepthTotal + analysisBYes.askDepthTotal,
    analysisBNo.bidDepthTotal + analysisBNo.askDepthTotal
  );
  if (tradeSize > minDepth * 0.5) {
    signals.push(`Trade size (${tradeSize}) is large relative to book depth (${minDepth.toFixed(0)})`);
  }

  // Imbalance warning
  const imbalances = [
    { name: "A-YES", imb: analysisAYes.depthImbalance },
    { name: "A-NO", imb: analysisANo.depthImbalance },
    { name: "B-YES", imb: analysisBYes.depthImbalance },
    { name: "B-NO", imb: analysisBNo.depthImbalance },
  ];

  for (const { name, imb } of imbalances) {
    if (Math.abs(imb) > 0.5) {
      const direction = imb > 0 ? "bid-heavy" : "ask-heavy";
      signals.push(`${name} book is ${direction} (imbalance: ${(imb * 100).toFixed(1)}%)`);
    }
  }

  return signals;
}

/**
 * Analyze a single market for internal inefficiencies
 * 
 * Checks if YES + NO prices create an opportunity
 */
export function analyzeMarketEfficiency(
  market: MarketOrderBooks,
  tradeSize: number
): {
  yesPrice: number;
  noPrice: number;
  sum: number;
  vigorish: number;
  isEfficient: boolean;
  signal: string;
} {
  const execYes = calculateExecutionPrice(market.yes, { side: "BUY", outcome: "YES", size: tradeSize });
  const execNo = calculateExecutionPrice(market.no, { side: "BUY", outcome: "NO", size: tradeSize });

  const sum = execYes.averagePrice + execNo.averagePrice;
  const vigorish = (sum - 1) * 100; // Positive = overpriced, negative = underpriced

  let signal: string;
  let isEfficient = true;

  if (sum < 0.98) {
    signal = `Underpriced: Buy both YES and NO for guaranteed profit of ${((1 - sum) * 100).toFixed(2)}%`;
    isEfficient = false;
  } else if (sum > 1.02) {
    signal = `Overpriced: Market has ${vigorish.toFixed(2)}% built-in vig`;
    isEfficient = true; // Overpriced is normal due to fees
  } else {
    signal = "Market is efficiently priced";
    isEfficient = true;
  }

  return {
    yesPrice: execYes.averagePrice,
    noPrice: execNo.averagePrice,
    sum,
    vigorish,
    isEfficient,
    signal,
  };
}

/**
 * Find size where arbitrage edge disappears
 * 
 * Starting from a detected edge, increase size until slippage kills it
 */
export function findArbExhaustionPoint(
  orderBookA: OrderBook,
  orderBookB: OrderBook,
  side: "BUY" | "SELL",
  initialEdge: number
): { exhaustionSize: number; edgeAtExhaustion: number } {
  if (initialEdge <= 0) {
    return { exhaustionSize: 0, edgeAtExhaustion: 0 };
  }

  // Test increasing sizes
  const testSizes = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  let lastViableSize = 0;
  let lastEdge = initialEdge;

  for (const size of testSizes) {
    const execA = calculateExecutionPrice(orderBookA, { side, outcome: "YES", size });
    const execB = calculateExecutionPrice(orderBookB, { side, outcome: "YES", size });

    // Combined slippage
    const slippage = execA.slippagePercent + execB.slippagePercent;
    const edgeRemaining = initialEdge * 100 - slippage;

    if (edgeRemaining > 0) {
      lastViableSize = size;
      lastEdge = edgeRemaining / 100;
    } else {
      break;
    }
  }

  return {
    exhaustionSize: lastViableSize,
    edgeAtExhaustion: lastEdge,
  };
}
