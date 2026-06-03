import { NextResponse } from "next/server";
import { marketData } from "@/lib/market/provider";

export async function GET() {
  return NextResponse.json(await marketData.getMarketStatus());
}
