import { NextResponse } from "next/server";
import { marketData } from "@/lib/market/provider";
import { SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/rules/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const symbol = (await params).symbol.toUpperCase();
  if (!SUPPORTED_SYMBOLS.includes(symbol as SupportedSymbol)) {
    return NextResponse.json({ error: "Unsupported symbol." }, { status: 404 });
  }
  return NextResponse.json(await marketData.getLatestCandle(symbol as SupportedSymbol));
}
