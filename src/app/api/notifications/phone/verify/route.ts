import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyPhoneCode } from "@/lib/db/repositories";

const verifySchema = z.object({
  phoneNumber: z.string().trim().min(8),
  code: z.string().trim().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = verifySchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Enter the 6-digit verification code." }, { status: 400 });
  }

  const verification = verifyPhoneCode(user.id, result.data.phoneNumber, result.data.code);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: 400 });
  }
  return NextResponse.json({ channel: verification.channel });
}
