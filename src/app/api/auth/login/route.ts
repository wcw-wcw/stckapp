import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/db/repositories";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!allowAttempt(`login:${ip}`, 8)) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  const result = loginSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const user = await findUserByEmail(result.data.email);
  if (!user || !(await verifyPassword(result.data.password, user.password_hash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email, role: user.role } });
}
