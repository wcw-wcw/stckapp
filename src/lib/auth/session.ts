import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import {
  createSessionRecord,
  deleteSessionByTokenHash,
  getSessionUserByTokenHash,
} from "@/lib/db/repositories";

const COOKIE_NAME = "signaldesk_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  role: "user" | "admin";
};

const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60_000);
  await createSessionRecord({
    id: randomUUID(),
    userId,
    tokenHash: tokenHash(token),
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  });

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await deleteSessionByTokenHash(tokenHash(token));
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getSessionUserByTokenHash(tokenHash(token), new Date().toISOString());
}
