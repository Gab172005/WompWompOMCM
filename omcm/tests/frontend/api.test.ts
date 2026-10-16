import { afterEach, describe, expect, it, vi } from "vitest";
import { api, clearCredentials, setCredentials } from "../../frontend/src/services/api";
afterEach(() => {
  clearCredentials();
  vi.unstubAllGlobals();
});
describe("API integration contract", () => {
  it("sends optimization parameters to Python and returns its calculated plan", async () => {
    const result = {
      plan_id: "server-plan",
      optimized: { metrics: { residents_served: 415 } },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setCredentials("planner", "temporary-test-password");
    expect(await api("/optimize", { clinic_count: 3, capacity: 180 })).toEqual(
      result,
    );
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/optimize");
    expect(request.method).toBe("POST");
    expect(JSON.parse(request.body)).toEqual({
      clinic_count: 3,
      capacity: 180,
    });
    expect(request.headers.Authorization).toMatch(/^Basic /);
  });
  it("reports server validation failures instead of successful placeholder results", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              detail: [{ loc: ["body", "capacity"], msg: "must be positive" }],
            }),
            { status: 422 },
          ),
        ),
    );
    await expect(api("/optimize", { capacity: 0 })).rejects.toThrow(
      "body.capacity: must be positive",
    );
  });
  it("reports an unavailable backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Failed to fetch")),
    );
    await expect(api("/barangays")).rejects.toThrow("Failed to fetch");
  });
  it("does not send administrator credentials after sign-out", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    setCredentials("admin", "password");
    clearCredentials();
    await api("/schedules");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});
