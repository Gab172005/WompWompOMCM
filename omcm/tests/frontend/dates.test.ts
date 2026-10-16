import { expect, it } from "vitest";
import { addDays } from "../../frontend/src/services/dates";
it("schedules tomorrow across month and year boundaries without timezone shifting", () => {
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
});
