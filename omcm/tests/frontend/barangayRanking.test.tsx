import { ordinal } from "../../frontend/src/services/planningLanguage";
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
import {
  LAGUNA_BARANGAYS,
  OSM_CLINIC_SNAPSHOT,
  OSM_CLINICS_BY_BARANGAY,
  RANKED_BARANGAYS,
} from "../../frontend/src/services/providedData";
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
    fireEvent.change(
      within(region).getByLabelText("Find a barangay in this list"),
      {
        target: { value: `${top.name} ${top.municipality}` },
      },
    );
    fireEvent.click(
      within(region).getByRole("button", {
        name: new RegExp(`^Rank ${top.needRank}:`),
      }),
    );
    expect(useAppStore.getState().selectedBarangayPsgc).toBe(top.psgc);
  }, 20000);
  it("shows the seven weighted factors, raw clinic metrics and no urban/rural contribution", () => {
    const b = RANKED_BARANGAYS.find(
      (item) => item.needProvisional && item.clinicCount !== null,
    )!;
    render(<BarangayRanking municipalityPsgc={b.municipalityPsgc} />);
    const region = screen.getByRole("region", {
      name: "Barangay healthcare need ranking",
    });
    expect(
      within(region).getByText(
        /Rank 1 has the highest estimated healthcare need/,
      ),
    ).toBeInTheDocument();
    fireEvent.change(
      within(region).getByLabelText("Find a barangay in this list"),
      {
        target: { value: b.name },
      },
    );
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
      `${ordinal(b.needRank)} highest estimated healthcare need among 681 barangays in Laguna`,
    );
    // Coverage is dynamic: missing factors exclude their weight, never zero them.
    expect(detail).toHaveTextContent(
      `Share of score factors available${b.needCoverage}%`,
    );
    expect(detail).toHaveTextContent(b.needScore.toFixed(1));
    expect(detail).toHaveTextContent(
      "Municipal resources (income class) · 10% base weight",
    );
    expect(detail).toHaveTextContent(`${b.incomeClass} municipality class`);
    expect(detail).toHaveTextContent("resource proxy");
    expect(detail).toHaveTextContent(
      "Distance to a mapped clinic · 5% base weight",
    );
    expect(detail).toHaveTextContent(
      "Fewer mapped clinics per resident · 5% base weight",
    );
    expect(detail).toHaveTextContent(
      `Mapped OSM clinics in this barangay: ${b.clinicCount}`,
    );
    if (!b.clinicCount)
      expect(detail).toHaveTextContent("not verified absence");
    expect(detail).toHaveTextContent(
      `${b.clinicsPer10000!.toFixed(2)} per 10,000 residents`,
    );
    if (b.nearestClinic)
      expect(detail).toHaveTextContent(
        `Nearest active OSM clinic: ${b.nearestClinic.name}`,
      );
    // Urban/rural is demographic context only and never contributes weight.
    expect(detail).toHaveTextContent(
      `Urban / rural classification · ${b.urbanRural} · demographic context, not scored`,
    );
    expect(detail).not.toHaveTextContent("Urban / rural classification · 10%");
    expect(detail).not.toHaveTextContent("classification proxy");
    expect(detail).toHaveTextContent("Missing data never means zero need");
    expect(detail).toHaveTextContent(
      "Clinic distance is the percentile of the straight-line distance",
    );
    // Method text must not claim every factor is a percentile or that a zero
    // mapped count proves unmet need.
    expect(detail).toHaveTextContent(
      "Disaster risk uses the supplied 0–100 index directly, not a percentile",
    );
    expect(detail).toHaveTextContent("not a percentile");
    expect(detail).toHaveTextContent("not verified absence");
    expect(detail).toHaveTextContent(
      "That competition ranking applies to rounded total scores",
    );
    expect(detail).not.toHaveTextContent("Every bar is a percentile");
    expect(detail).not.toHaveTextContent("largest deficit");
  });
  it("explains the OSM snapshot and lists assigned clinic records separately from hospitals", () => {
    const withClinic = LAGUNA_BARANGAYS.find(
      (item) => (OSM_CLINICS_BY_BARANGAY.get(item.psgc) ?? []).length,
    )!;
    useAppStore
      .getState()
      .selectBarangay(withClinic.psgc, withClinic.municipalityPsgc);
    render(<BarangayPanel />);
    const detail = screen.getByRole("region", {
      name: "Barangay healthcare need",
    });
    const clinics = OSM_CLINICS_BY_BARANGAY.get(withClinic.psgc)!;
    fireEvent.click(
      within(detail).getByText("Fixed clinic records and sources"),
    );
    expect(detail).toHaveTextContent(
      `Assigned active OSM clinic records (${clinics.length})`,
    );
    expect(detail).toHaveTextContent(clinics[0].name);
    const link = within(detail)
      .getAllByRole("link", { name: "OpenStreetMap record" })
      .at(0)!;
    expect(link).toHaveAttribute(
      "href",
      `https://www.openstreetmap.org/${clinics[0].osmType}/${clinics[0].osmId}`,
    );
    // Snapshot provenance is dated and attributed, never asserted as absence.
    expect(detail).toHaveTextContent(
      OSM_CLINIC_SNAPSHOT.retrievedAt ?? "Unrecorded",
    );
    expect(detail).toHaveTextContent(OSM_CLINIC_SNAPSHOT.attribution);
    expect(detail).toHaveTextContent("incomplete mapping observation");
    expect(
      screen.getByRole("heading", { name: "Nearby care" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Nearby verified hospitals" }),
    ).toHaveTextContent("Actual travel distance and time may be longer");
  });
  it("states that zero OSM records are unverified rather than absent", () => {
    const empty = LAGUNA_BARANGAYS.find(
      (item) => (OSM_CLINICS_BY_BARANGAY.get(item.psgc) ?? []).length === 0,
    )!;
    useAppStore.getState().selectBarangay(empty.psgc, empty.municipalityPsgc);
    render(<BarangayPanel />);
    const detail = screen.getByRole("region", {
      name: "Barangay healthcare need",
    });
    expect(detail).toHaveTextContent("0 OSM clinics recorded in this barangay");
    expect(detail).toHaveTextContent(
      "This is a mapped observation, not verified absence",
    );
  });
});
