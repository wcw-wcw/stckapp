import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(async () => null),
}));

vi.mock("@/lib/health", () => ({
  getDeepHealth: vi.fn(async () => ({ status: "ok" })),
}));

describe("deep health route", () => {
  it("requires authentication", async () => {
    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });
});
