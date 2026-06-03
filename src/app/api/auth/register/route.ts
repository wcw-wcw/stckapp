import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { getDatabase } from "@/lib/db/local";
import { addWatchlistSymbol } from "@/lib/db/repositories";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(128),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!allowAttempt(`register:${ip}`, 5)) {
    return NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429 });
  }

  const result = registerSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const database = getDatabase();
  const existing = database.prepare("SELECT id FROM users WHERE email = ?").get(result.data.email);
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  database
    .prepare(
      "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(id, result.data.email, await hashPassword(result.data.password), now, now);
  ["SPY", "QQQ", "NVDA", "AAPL"].forEach((symbol) =>
    addWatchlistSymbol(id, symbol as "SPY" | "QQQ" | "NVDA" | "AAPL"),
  );
  await createSession(id);
  return NextResponse.json({ user: { id, email: result.data.email, role: "user" } }, { status: 201 });
}
