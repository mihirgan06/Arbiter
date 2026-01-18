/**
 * Resolution Payoff Calculator
 * 
 * Calculates P&L for different resolution outcomes given execution prices.
 * 
 * KEY INSIGHT: In binary prediction markets:
 * - If you BUY YES at price P: you pay P per contract, receive 1 if YES resolves, 0 if NO
 * - If you BUY NO at price P: you pay P per contract, receive 1 if NO resolves, 0 if YES
 * - If you SELL YES at price P: you receive P per contract, pay 1 if YES resolves, 0 if NO
 * - If you SELL NO at price P: you receive P per contract, pay 1 if NO resolves, 0 if YES
 */

import type {
  ExecutionResult,
  PayoffResult,
  TradeSide,
  Outcome,
} from "@/lib/execution-types";

/**
 * Calculate payoff for a position given execution results
 * 
 * @param execution - Result from calculateExecutionPrice
 * @returns Full payoff analysis
 */
export function calculatePayoff(execution: ExecutionResult): PayoffResult {
  const { side, outcome, filledSize, averagePrice, totalCost } = execution;

  // If nothing was filled, return zero payoff
  if (filledSize === 0) {
    return createZeroPayoff(execution);
  }

  // Calculate P&L for each resolution scenario
  const { pnlIfYes, pnlIfNo } = calculateResolutionPnL(
    side,
    outcome,
    filledSize,
    averagePrice
  );

  // Returns as percentage of capital deployed
  const capitalDeployed = Math.abs(totalCost);
  const returnIfYes = capitalDeployed > 0 ? (pnlIfYes / capitalDeployed) * 100 : 0;
  const returnIfNo = capitalDeployed > 0 ? (pnlIfNo / capitalDeployed) * 100 : 0;

  // Risk metrics
  const maxGain = Math.max(pnlIfYes, pnlIfNo);
  const maxLoss = Math.min(pnlIfYes, pnlIfNo);
  const capitalAtRisk = Math.abs(maxLoss);

  return {
    side,
    outcome,
    contracts: filledSize,
    entryPrice: averagePrice,
    totalCost,
    pnlIfYes,
    returnIfYes,
    pnlIfNo,
    returnIfNo,
    maxGain,
    maxLoss,
    capitalAtRisk,
    impliedProbability: averagePrice, // In binary markets, price = implied prob
  };
}

/**
 * Calculate P&L for YES and NO resolution scenarios
 * 
 * This is the core payoff logic:
 * 
 * BUY YES at P:
 *   - Cost: P * contracts
 *   - If YES resolves: receive 1 * contracts → P&L = (1 - P) * contracts
 *   - If NO resolves: receive 0 → P&L = -P * contracts
 * 
 * BUY NO at P:
 *   - Cost: P * contracts
 *   - If YES resolves: receive 0 → P&L = -P * contracts
 *   - If NO resolves: receive 1 * contracts → P&L = (1 - P) * contracts
 * 
 * SELL YES at P:
 *   - Receive: P * contracts upfront
 *   - If YES resolves: pay 1 * contracts → P&L = (P - 1) * contracts
 *   - If NO resolves: pay 0 → P&L = P * contracts
 * 
 * SELL NO at P:
 *   - Receive: P * contracts upfront
 *   - If YES resolves: pay 0 → P&L = P * contracts
 *   - If NO resolves: pay 1 * contracts → P&L = (P - 1) * contracts
 */
function calculateResolutionPnL(
  side: TradeSide,
  outcome: Outcome,
  contracts: number,
  price: number
): { pnlIfYes: number; pnlIfNo: number } {
  // Long position (BUY)
  if (side === "BUY") {
    if (outcome === "YES") {
      // BUY YES: profit if YES, lose if NO
      return {
        pnlIfYes: (1 - price) * contracts,  // Win: receive $1, paid price
        pnlIfNo: -price * contracts,        // Lose: receive $0, paid price
      };
    } else {
      // BUY NO: profit if NO, lose if YES
      return {
        pnlIfYes: -price * contracts,       // Lose: receive $0, paid price
        pnlIfNo: (1 - price) * contracts,   // Win: receive $1, paid price
      };
    }
  }
  
  // Short position (SELL)
  if (outcome === "YES") {
    // SELL YES: profit if NO, lose if YES
    return {
      pnlIfYes: (price - 1) * contracts,  // Lose: received price, pay $1
      pnlIfNo: price * contracts,         // Win: received price, pay $0
    };
  } else {
    // SELL NO: profit if YES, lose if NO
    return {
      pnlIfYes: price * contracts,        // Win: received price, pay $0
      pnlIfNo: (price - 1) * contracts,   // Lose: received price, pay $1
    };
  }
}

/**
 * Create a zero payoff for unfilled orders
 */
function createZeroPayoff(execution: ExecutionResult): PayoffResult {
  return {
    side: execution.side,
    outcome: execution.outcome,
    contracts: 0,
    entryPrice: 0,
    totalCost: 0,
    pnlIfYes: 0,
    returnIfYes: 0,
    pnlIfNo: 0,
    returnIfNo: 0,
    maxGain: 0,
    maxLoss: 0,
    capitalAtRisk: 0,
    impliedProbability: 0,
  };
}

/**
 * Calculate combined payoff for a multi-leg position
 * 
 * Useful for analyzing hedged positions or spreads
 */
export function calculateCombinedPayoff(executions: ExecutionResult[]): {
  totalCost: number;
  pnlIfYes: number;
  pnlIfNo: number;
  maxGain: number;
  maxLoss: number;
} {
  let totalCost = 0;
  let pnlIfYes = 0;
  let pnlIfNo = 0;

  for (const execution of executions) {
    const payoff = calculatePayoff(execution);
    totalCost += payoff.totalCost;
    pnlIfYes += payoff.pnlIfYes;
    pnlIfNo += payoff.pnlIfNo;
  }

  return {
    totalCost,
    pnlIfYes,
    pnlIfNo,
    maxGain: Math.max(pnlIfYes, pnlIfNo),
    maxLoss: Math.min(pnlIfYes, pnlIfNo),
  };
}

/**
 * Calculate breakeven probability for a position
 * 
 * Returns the probability at which the expected value is zero
 */
export function calculateBreakevenProbability(
  side: TradeSide,
  outcome: Outcome,
  entryPrice: number
): number {
  // For BUY YES at price P:
  // EV = P(yes) * (1 - P) + P(no) * (-P) = 0
  // P(yes) * (1 - P) = P(no) * P
  // P(yes) * (1 - P) = (1 - P(yes)) * P
  // P(yes) - P(yes)*P = P - P(yes)*P
  // P(yes) = P
  // Breakeven = entry price
  
  // For SELL YES at price P:
  // Breakeven is also P (you're neutral at your entry price)
  
  return entryPrice;
}

/**
 * Calculate Kelly criterion for position sizing
 * 
 * Kelly fraction = (bp - q) / b
 * where:
 *   b = net odds (payout / stake)
 *   p = probability of winning
 *   q = probability of losing (1 - p)
 * 
 * @param trueProb - Your estimated true probability
 * @param marketPrice - Current market price (implied probability)
 * @param side - Which side you'd trade
 * @param outcome - YES or NO
 */
export function calculateKellyFraction(
  trueProb: number,
  marketPrice: number,
  side: TradeSide,
  outcome: Outcome
): { fraction: number; edge: number } {
  // Calculate edge (difference between true prob and market price)
  // For BUY YES: edge = trueProb - marketPrice
  // For SELL YES: edge = marketPrice - trueProb
  // For BUY NO: edge = (1 - trueProb) - marketPrice
  // For SELL NO: edge = marketPrice - (1 - trueProb)
  
  let winProb: number;
  let loseProb: number;
  let payoffIfWin: number;
  let lossIfLose: number;

  if (side === "BUY" && outcome === "YES") {
    winProb = trueProb;
    loseProb = 1 - trueProb;
    payoffIfWin = 1 - marketPrice; // Receive $1, paid marketPrice
    lossIfLose = marketPrice;      // Lose stake
  } else if (side === "BUY" && outcome === "NO") {
    winProb = 1 - trueProb;
    loseProb = trueProb;
    payoffIfWin = 1 - marketPrice;
    lossIfLose = marketPrice;
  } else if (side === "SELL" && outcome === "YES") {
    winProb = 1 - trueProb;        // Win if NO resolves
    loseProb = trueProb;
    payoffIfWin = marketPrice;      // Keep premium
    lossIfLose = 1 - marketPrice;  // Pay out $1 - premium
  } else {
    // SELL NO
    winProb = trueProb;            // Win if YES resolves
    loseProb = 1 - trueProb;
    payoffIfWin = marketPrice;
    lossIfLose = 1 - marketPrice;
  }

  // Kelly: f* = (p*b - q) / b where b = payoff/loss ratio
  const b = payoffIfWin / lossIfLose;
  const kelly = (winProb * b - loseProb) / b;

  // Expected edge per dollar
  const edge = winProb * payoffIfWin - loseProb * lossIfLose;

  return {
    fraction: Math.max(0, kelly), // Don't recommend negative sizing
    edge,
  };
}
