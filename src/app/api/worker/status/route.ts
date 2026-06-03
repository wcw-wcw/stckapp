import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocalWorkerStatus } from "@/lib/worker/local-worker-loop";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json(getLocalWorkerStatus());
}
