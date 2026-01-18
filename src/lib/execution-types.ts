/**
 * Execution-Aware Analytics Types
 * 
 * These types support realistic trade simulation using order book data.
 * All prices are execution-aware (NOT midpoint-based).
 */

// ============================================
// ORDER BOOK TYPES
// ============================================

/**
 * A single price level in an order book
 */
export type OrderBookLevel = {
  price: number;  // Price per contract (0-1 range for prediction markets)
  size: number;   // Number of contracts available at this price
};

/**
 * Full order book for a market outcome
 * - bids: Offers to BUY (sorted descending by price - best bid first)
 * - asks: Offers to SELL (sorted ascending by price - best ask first)
 */
export type OrderBook = {
  bids: OrderBookLevel[];  // Sorted DESC (highest price first)
  asks: OrderBookLevel[];  // Sorted ASC (lowest price first)
  timestamp: Date;
  tokenId: string;
  marketId: string;
};

/**
 * Order book for both YES and NO outcomes of a market
 */
export type MarketOrderBooks = {
  marketId: string;
  question: string;
  yes: OrderBook;
  no: OrderBook;
  fetchedAt: Date;
};

// ============================================
// TRADE INPUT / OUTPUT TYPES
// ============================================

export type TradeSide = "BUY" | "SELL";
export type Outcome = "YES" | "NO";

/**
 * Input for simulating a trade
 */
export type TradeInput = {
  side: TradeSide;
  outcome: Outcome;
  size: number;  // Number of contracts to trade
};

/**
 * Result of simulating trade execution
 */
export type ExecutionResult = {
  // Input echoed back
  side: TradeSide;
  outcome: Outcome;
  requestedSize: number;
  
  // Execution details
  filledSize: number;           // Contracts actually filled (may be less if book is thin)
  averagePrice: number;         // Weighted average execution price
  totalCost: number;            // Total cost for BUY, total proceeds for SELL
  
  // Price reference points
  bestPrice: number;            // Best bid (for SELL) or best ask (for BUY)
  worstPrice: number;           // Worst price level touched
  
  // Slippage analysis
  slippageFromBest: number;     // Difference from best price (always positive or zero)
  slippagePercent: number;      // Slippage as percentage of best price
  
  // Execution breakdown by level
  fills: Array<{
    price: number;
    size: number;
    cumulative: number;
  }>;
  
  // Warnings
  partialFill: boolean;         // True if order couldn't be fully filled
  remainingSize: number;        // Unfilled contracts
};

// ============================================
// PAYOFF / P&L TYPES
// ============================================

/**
 * Resolution payoff analysis
 */
export type PayoffResult = {
  // Position details
  side: TradeSide;
  outcome: Outcome;
  contracts: number;
  entryPrice: number;           // Average execution price
  totalCost: number;            // Capital deployed
  
  // If event resolves YES
  pnlIfYes: number;             // Profit (positive) or Loss (negative)
  returnIfYes: number;          // Return as percentage of cost
  
  // If event resolves NO
  pnlIfNo: number;
  returnIfNo: number;
  
  // Risk metrics
  maxGain: number;              // Best case profit
  maxLoss: number;              // Worst case loss (always negative or zero)
  capitalAtRisk: number;        // Maximum amount that could be lost
  
  // Breakeven
  impliedProbability: number;   // Price = implied probability for binary markets
};

// ============================================
// ARBITRAGE / CROSS-MARKET TYPES
// ============================================

/**
 * Input for comparing two related markets
 */
export type MarketComparisonInput = {
  marketA: {
    marketId: string;
    tokenIdYes: string;
    tokenIdNo: string;
  };
  marketB: {
    marketId: string;
    tokenIdYes: string;
    tokenIdNo: string;
  };
  tradeSize: number;  // Size to simulate for comparison
};

/**
 * Result of cross-market comparison
 */
export type MarketComparisonResult = {
  marketA: {
    marketId: string;
    question: string;
    executionPriceYes: number;
    executionPriceNo: number;
    spreadWidth: number;
    depthAtSize: number;
  };
  marketB: {
    marketId: string;
    question: string;
    executionPriceYes: number;
    executionPriceNo: number;
    spreadWidth: number;
    depthAtSize: number;
  };
  
  // Inefficiency analysis
  priceDifferenceYes: number;   // A.yes - B.yes
  priceDifferenceNo: number;    // A.no - B.no
  
  // Arbitrage signals (NOT risk-free, execution-aware)
  apparentArbitrage: boolean;
  arbitrageEdge: number;        // Combined edge if arb exists
  
  // Viability analysis
  maxViableSize: number;        // Size where edge disappears
  slippageAtSize: number;       // Combined slippage at requested size
  
  // Dominance check
  dominanceViolation: boolean;  // True if prices don't make logical sense
  dominanceDetails?: string;    // Explanation of violation
  
  // Risk signals
  riskSignals: string[];
};

/**
 * Spread and depth analysis for a single order book
 */
export type OrderBookAnalysis = {
  // Spread
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPercent: number;
  midpoint: number;  // For reference only, NOT used in execution
  
  // Depth
  bidDepthTotal: number;        // Total contracts on bid side
  askDepthTotal: number;        // Total contracts on ask side
  depthImbalance: number;       // (bids - asks) / (bids + asks)
  
  // Exhaustion points
  sizeToMoveBid1Percent: number;   // Contracts to move best bid down 1%
  sizeToMoveAsk1Percent: number;   // Contracts to move best ask up 1%
  
  // Book quality
  levelCount: number;
  averageLevelSize: number;
};
