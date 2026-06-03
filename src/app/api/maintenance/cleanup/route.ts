import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { runLocalCleanup } from "@/lib/maintenance/cleanup";

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cleanup can only be run from the local app." }, { status: 403 });
  }

  return NextResponse.json({ deleted: await runLocalCleanup() });
}
