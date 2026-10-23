import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { BarangayRanking } from "../../frontend/src/features/municipalities/BarangayRanking";
import { BarangayPanel } from "../../frontend/src/features/municipalities/BarangayPanel";
import { RANKED_BARANGAYS } from "../../frontend/src/services/providedData";
import { useAppStore } from "../../frontend/src/store/useAppStore";
afterEach(cleanup);
describe("Barangay healthcare need ranking interface", () => {
  it("paginates the province-wide ranking, filters it and selects a ranked barangay", () => {
    render(<BarangayRanking />);
    const region = screen.getByRole("region", {
      name: "Barangay healthcare need ranking",
    });
    expect(within(region).getAllByRole("listitem")).toHaveLength(25);
    expect(
      within(region).getByRole("button", { name: /Previous ranks/ }),
    ).toBeDisabled();
    fireEvent.click(within(region).getByRole("button", { name: "Next ranks" }));
    expect(within(region).getByRole("status")).toHaveTextContent(
      "26–50 of 681",
    );
    for (let index = 0; index < 26; index++)
      fireEvent.click(
        within(region).getByRole("button", { name: "Next ranks" }),
      );
    expect(within(region).getAllByRole("listitem")).toHaveLength(6);
    expect(within(region).getByRole("status")).toHaveTextContent(
      "676–681 of 681",
    );
    expect(
      within(region).getByRole("button", { name: "Next ranks" }),
    ).toBeDisabled();
    const top = RANKED_BARANGAYS[0];
    fireEvent.change(within(region).getByLabelText("Filter barangay ranking"), {
      target: { value: `${top.name} ${top.municipality}` },
    });
    fireEvent.click(
      within(region).getByRole("button", {
        name: new RegExp(`^Rank ${top.needRank}:`),
      }),
    );
    expect(useAppStore.getState().selectedBarangayPsgc).toBe(top.psgc);
  });
  it("shows provincial ranks when filtered to a municipality and displays the selected score", () => {
    const b = RANKED_BARANGAYS.find((item) => item.needProvisional)!;
    render(<BarangayRanking municipalityPsgc={b.municipalityPsgc} />);
    const region = screen.getByRole("region", {
      name: "Barangay healthcare need ranking",
    });
    expect(within(region).getByText(/Province-wide ranks/)).toBeInTheDocument();
    fireEvent.change(within(region).getByLabelText("Filter barangay ranking"), {
      target: { value: b.name },
    });
    fireEvent.click(
      within(region).getByRole("button", {
        name: new RegExp(`^Rank ${b.needRank}:`),
      }),
    );
    cleanup();
    render(<BarangayPanel />);
    const detail = screen.getByRole("region", {
      name: "Barangay healthcare need",
    });
    expect(detail).toHaveTextContent(
      `Healthcare need rank #${b.needRank} of 681`,
    );
    expect(detail).toHaveTextContent("Provisional score and rank · 80%");
    expect(detail).toHaveTextContent(b.needScore.toFixed(1));
    expect(detail).toHaveTextContent(
      "Municipality income class · 10% base weight",
    );
    expect(detail).toHaveTextContent(`${b.incomeClass} municipality class`);
    expect(detail).toHaveTextContent(
      "Urban / rural classification · 10% base weight",
    );
    expect(detail).toHaveTextContent(`${b.urbanRural} ·`);
    expect(detail).toHaveTextContent("classification proxy");
    expect(detail).toHaveTextContent("Missing factors are not treated as zero");
  });
});
