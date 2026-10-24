import { describe, expect, it } from "vitest";
import { requestFeedback } from "./requestFeedback";

describe("Planning request feedback", () => {
  it("names validation fields without exposing server paths or internal errors", () => {
    const message = requestFeedback("/optimize", 422, [
      { loc: ["body", "scenario", "clinic_count"], msg: "int_parsing" },
      { loc: ["body", "scenario", "capacity"], msg: "greater_than" },
      null,
    ]);
    expect(message).toContain("Number of clinics");
    expect(message).toContain("Appointments per clinic per day");
    expect(message).not.toMatch(/body|scenario|int_parsing|greater_than/);
  });

  it("preserves the reason a published schedule cannot be replaced", () => {
    const rule =
      "A schedule is already published for this date. Use the confirmed emergency override to replace it.";
    expect(requestFeedback("/schedules/approve", 409, rule)).toBe(rule);
  });

  it("offers a useful recovery action for unavailable planning results", () => {
    expect(
      requestFeedback(
        "/optimize",
        422,
        "No feasible allocation for these manual locations.",
      ),
    ).toContain("Try fewer clinics");
    expect(
      requestFeedback("/simulate", 500, "Traceback: engine failed"),
    ).toContain("calculate this practice scenario");
    expect(
      requestFeedback("/simulate", 500, "Traceback: engine failed"),
    ).not.toContain("Traceback");
    expect(
      requestFeedback("/auth/me", 401, "Invalid administrator credentials."),
    ).toContain("sign in again");
  });
});
