import { NextResponse } from "next/server";
import { marketAggregator } from "@/services/aggregator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await marketAggregator.getDashboardData();
    
    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Failed to fetch markets:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch market data",
      },
      { status: 500 }
    );
  }
}

