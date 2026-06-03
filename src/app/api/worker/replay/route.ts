import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { runLocalReplay, runReplayDataset } from "@/lib/worker/local-mock-worker";

const replaySchema = z.object({
  candles: z.number().int().min(80).max(2_000).optional(),
  datasetId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const result = replaySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Choose between 80 and 2,000 replay candles." }, { status: 400 });
  }

  if (result.data.datasetId) {
    return NextResponse.json(await runReplayDataset(user.id, result.data.datasetId));
  }

  return NextResponse.json(await runLocalReplay(user.id, result.data.candles ?? 390));
}
