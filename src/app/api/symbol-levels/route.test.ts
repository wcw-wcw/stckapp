import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const listSymbolLevels = vi.fn();
const createSymbolLevel = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));
vi.mock("@/lib/db/repositories", () => ({
  listSymbolLevels,
  createSymbolLevel,
}));

describe("symbol levels route", () => {
  afterEach(() => {
    getCurrentUser.mockReset();
    listSymbolLevels.mockReset();
    createSymbolLevel.mockReset();
  });

  it("requires authentication", async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/symbol-levels?symbol=SPY"));

    expect(response.status).toBe(401);
    expect(listSymbolLevels).not.toHaveBeenCalled();
  });

  it("validates supported symbols on list", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "user-1", email: "a@example.com", role: "user" });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/symbol-levels?symbol=BAD"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Choose a supported symbol." });
    expect(listSymbolLevels).not.toHaveBeenCalled();
  });

  it("lists only the current user's symbol levels", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "user-1", email: "a@example.com", role: "user" });
    listSymbolLevels.mockResolvedValueOnce([{ id: "level-1", symbol: "SPY", price: 500 }]);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/symbol-levels?symbol=spy"));

    expect(response.status).toBe(200);
    expect(listSymbolLevels).toHaveBeenCalledWith("user-1", "SPY");
    await expect(response.json()).resolves.toMatchObject({ levels: [{ id: "level-1" }] });
  });

  it("rejects invalid create payloads", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "user-1", email: "a@example.com", role: "user" });
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/symbol-levels", {
        method: "POST",
        body: JSON.stringify({ symbol: "SPY", name: "", price: 0, levelType: "pivot" }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Name is required.");
    expect(body.error).toContain("Price must be greater than 0.");
    expect(body.error).toContain("Choose a valid level type.");
    expect(createSymbolLevel).not.toHaveBeenCalled();
  });

  it("creates a validated level for the current user without exposing secrets", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "user-1", email: "a@example.com", role: "user" });
    createSymbolLevel.mockResolvedValueOnce({
      id: "level-1",
      symbol: "SPY",
      name: "Resistance",
      price: 510,
      levelType: "resistance",
    });
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/symbol-levels", {
        method: "POST",
        body: JSON.stringify({ symbol: "spy", name: "Resistance", price: "510", levelType: "resistance" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createSymbolLevel).toHaveBeenCalledWith("user-1", {
      symbol: "SPY",
      name: "Resistance",
      price: 510,
      levelType: "resistance",
      expiresAt: null,
    });
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
