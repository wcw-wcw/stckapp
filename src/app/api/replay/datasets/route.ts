import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createReplayDataset,
  listReplayDatasets,
} from "@/lib/db/repositories";
import { validateReplayDataset } from "@/lib/replay/candle-dataset";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ datasets: await listReplayDatasets(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = validateReplayDataset(await request.json());
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  const dataset = await createReplayDataset(user.id, result.data);
  return NextResponse.json({ dataset }, { status: 201 });
}
