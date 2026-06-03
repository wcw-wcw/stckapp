import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { addWatchlistSymbol, listWatchlist } from "@/lib/db/repositories";
import { SUPPORTED_SYMBOLS } from "@/lib/rules/types";

const watchlistSchema = z.object({ symbol: z.enum(SUPPORTED_SYMBOLS) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ symbols: listWatchlist(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const result = watchlistSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: "Unsupported symbol." }, { status: 400 });
  addWatchlistSymbol(user.id, result.data.symbol);
  return NextResponse.json({ symbols: listWatchlist(user.id) });
}
