import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const updateSymbolLevel = vi.fn();
const deleteSymbolLevel = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));
vi.mock("@/lib/db/repositories", () => ({
  updateSymbolLevel,
  deleteSymbolLevel,
}));

describe("symbol level detail route", () => {
  afterEach(() => {
    getCurrentUser.mockReset();
    updateSymbolLevel.mockReset();
    deleteSymbolLevel.mockReset();
  });

  it("requires authentication for updates", async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    const { PATCH } = await import("./route");

    const response = await PATCH(
      new Request("http://localhost/api/symbol-levels/level-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "level-1" }) },
    );

    expect(response.status).toBe(401);
    expect(updateSymbolLevel).not.toHaveBeenCalled();
  });

  it("validates update payloads", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "user-1", email: "a@example.com", role: "user" });
    const { PATCH } = await import("./route");

    const response = await PATCH(
      new Request("http://localhost/api/symbol-levels/level-1", {
        method: "PATCH",
        body: JSON.stringify({ price: -1, levelType: "pivot" }),
      }),
      { params: Promise.resolve({ id: "level-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Price must be greater than 0.");
    expect(body.error).toContain("Choose a valid level type.");
    expect(updateSymbolLevel).not.toHaveBeenCalled();
  });

  it("returns not found when the level is missing or owned by another user", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "user-1", email: "a@example.com", role: "user" });
    updateSymbolLevel.mockResolvedValueOnce(null);
    const { PATCH } = await import("./route");

    const response = await PATCH(
      new Request("http://localhost/api/symbol-levels/level-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "level-1" }) },
    );

    expect(response.status).toBe(404);
    expect(updateSymbolLevel).toHaveBeenCalledWith("user-1", "level-1", { name: "Updated" });
  });

  it("updates and deletes through current-user scoped repository calls", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "user-1", email: "a@example.com", role: "user" });
    updateSymbolLevel.mockResolvedValueOnce({ id: "level-1", name: "Updated" });
    const { PATCH, DELETE } = await import("./route");

    const patchResponse = await PATCH(
      new Request("http://localhost/api/symbol-levels/level-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "level-1" }) },
    );

    getCurrentUser.mockResolvedValueOnce({ id: "user-1", email: "a@example.com", role: "user" });
    deleteSymbolLevel.mockResolvedValueOnce(true);
    const deleteResponse = await DELETE(new Request("http://localhost/api/symbol-levels/level-1"), {
      params: Promise.resolve({ id: "level-1" }),
    });

    expect(patchResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(deleteSymbolLevel).toHaveBeenCalledWith("user-1", "level-1");
  });
});
