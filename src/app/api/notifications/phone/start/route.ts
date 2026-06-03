import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { startPhoneVerification } from "@/lib/db/repositories";

const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Use E.164 format, for example +13125550123."),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = phoneSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? "Enter a valid phone number." }, { status: 400 });
  }

  const verification = startPhoneVerification(user.id, result.data.phoneNumber);
  return NextResponse.json({
    expiresAt: verification.expiresAt,
    mockCode: verification.code,
    message: "Mock verification code generated locally. No SMS was sent.",
  });
}
