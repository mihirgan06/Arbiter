import { NextResponse } from "next/server";
import { marketAggregator } from "@/services/aggregator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { discrepancies } = await marketAggregator.getDashboardData();
    
    return NextResponse.json({
      success: true,
      discrepancies,
      count: discrepancies.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Failed to fetch discrepancies:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to detect discrepancies",
      },
      { status: 500 }
    );
  }
}

