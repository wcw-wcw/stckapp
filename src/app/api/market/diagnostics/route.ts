import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getProviderDiagnostics } from "@/lib/market/diagnostics";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json(await getProviderDiagnostics());
}
