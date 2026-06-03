import { NextResponse } from "next/server";
import { marketData } from "@/lib/market/provider";
import { backtestRule } from "@/lib/rules/backtest";
import { validateAlertRule } from "@/lib/rules/schema";

export async function POST(request: Request) {
  const result = validateAlertRule(await request.json());
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  const candles = await marketData.getHistoricalCandles(result.data.symbol, 2_000);
  return NextResponse.json(backtestRule(result.data, candles));
}
