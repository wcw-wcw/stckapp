import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createSymbolLevel, listSymbolLevels } from "@/lib/db/repositories";
import { SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/rules/types";
import { symbolLevelCreateSchema } from "@/lib/symbol-levels";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase();
  if (!symbol || !SUPPORTED_SYMBOLS.includes(symbol as SupportedSymbol)) {
    return NextResponse.json({ error: "Choose a supported symbol." }, { status: 400 });
  }

  try {
    return NextResponse.json({ levels: await listSymbolLevels(user.id, symbol as SupportedSymbol) });
  } catch {
    return NextResponse.json({ error: "Saved levels are unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = symbolLevelCreateSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const level = await createSymbolLevel(user.id, result.data);
    return NextResponse.json({ level }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Saved level could not be saved." }, { status: 500 });
  }
}
