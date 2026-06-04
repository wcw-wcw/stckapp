import { NextResponse } from "next/server";
import { getBasicHealth } from "@/lib/health";

export async function GET() {
  return NextResponse.json(await getBasicHealth());
}
