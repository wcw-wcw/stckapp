import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { removeWatchlistSymbol } from "@/lib/db/repositories";
import { SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/rules/types";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const symbol = (await params).symbol.toUpperCase();
  if (!SUPPORTED_SYMBOLS.includes(symbol as SupportedSymbol)) {
    return NextResponse.json({ error: "Unsupported symbol." }, { status: 400 });
  }
  removeWatchlistSymbol(user.id, symbol as SupportedSymbol);
  return NextResponse.json({ ok: true });
}
