import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { AppProviders } from "../../frontend/src/app/AppProviders";
import { MapControls } from "../../frontend/src/components/layout/MapControls";
import { FilterControls } from "../../frontend/src/features/filters/FilterControls";
import { MapLegend } from "../../frontend/src/features/map/components/MapLegend";
import { PublicSidePanel } from "../../frontend/src/features/public/PublicSidePanel";
import { AdminLoginModal } from "../../frontend/src/features/auth/AdminLoginModal";
import { DeploymentApproval } from "../../frontend/src/features/optimization/DeploymentApproval";
import { ClinicTracker } from "../../frontend/src/features/tracking/ClinicTracker";
import {
  addIsoDays,
  createInitialPublishedSchedules,
  emptyScenario,
  getManilaToday,
  useAppStore,
} from "../../frontend/src/store/useAppStore";
import {
  computeLagunaMunicipalities,
  runClinicOptimizer,
} from "../../frontend/src/services/lagunaData";
import { LAGUNA_BARANGAYS } from "../../frontend/src/services/providedData";

function resetStore() {
  useAppStore.setState({
    viewMode: "public",
    adminUser: null,
    loginModalOpen: false,
    pendingAdminPanel: null,
    selectedScheduleDate: getManilaToday(),
    publishedSchedules: createInitialPublishedSchedules(),
    selectedPsgc: null,
    selectedBarangayPsgc: null,
    activeMetric: "score",
    showHospitals: true,
    showClinics: true,
    showOsmClinics: true,
    sidePanelOpen: true,
    panel: null,
    clinicCount: 3,
    manualSiteOverrides: {},
    scenario: emptyScenario(),
    isPlaying: false,
    progress: 0,
    selectedClinicId: null,
    approvedPlan: null,
  });
}

beforeEach(resetStore);
afterEach(cleanup);

describe("Public and Admin View workspace", () => {
  it("hides admin planning tools and heatmap selectors in Public View while showing approved schedules and advisories", () => {
    render(
      <AppProviders>
        <MapControls />
        <FilterControls />
        <MapLegend />
        <PublicSidePanel />
      </AppProviders>,
    );

    expect(
      screen.getByRole("navigation", { name: "Public view controls" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Planning tools" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Heatmap layer")).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Hospitals" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Mobile clinics" }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Map legend")).toHaveTextContent(
      "Approved Care Locations",
    );
    expect(screen.getByRole("checkbox", { name: "OSM clinics" })).toBeChecked();
    const legend = screen.getByLabelText("Map legend");
    expect(legend).toHaveTextContent("fixed facility, not an approved mobile clinic");
    expect(legend).toHaveTextContent("© OpenStreetMap contributors");
    fireEvent.click(screen.getByRole("checkbox", { name: "OSM clinics" }));
    expect(legend).not.toHaveTextContent("OSM clinic");
    expect(legend).toHaveTextContent("Approved clinic");
    expect(legend).toHaveTextContent("Verified hospital");

    const panel = screen.getByRole("complementary", {
      name: "Community care and schedules",
    });
    expect(panel).toHaveTextContent("Approved Mobile Clinics (3)");
    expect(panel).toHaveTextContent("08:00–17:00 · Philippine time");
    expect(panel).toHaveTextContent("Primary care");
    expect(panel).toHaveTextContent("Public Health Advisories");
  });

  it("shows nearest approved mobile clinic and verified hospitals when a community is selected in Public View", () => {
    const sampleBarangay = LAGUNA_BARANGAYS[0];
    useAppStore
      .getState()
      .selectBarangay(sampleBarangay.psgc, sampleBarangay.municipalityPsgc);

    render(
      <AppProviders>
        <PublicSidePanel />
      </AppProviders>,
    );

    const communityLookup = screen.getByRole("region", {
      name: "Selected community care",
    });
    expect(communityLookup).toHaveTextContent(
      `${sampleBarangay.name}, ${sampleBarangay.municipality}`,
    );
    expect(communityLookup).toHaveTextContent(
      sampleBarangay.population.toLocaleString(),
    );
    expect(communityLookup).toHaveTextContent("Nearest approved mobile clinic");
    expect(communityLookup).toHaveTextContent("km straight-line distance");
    expect(communityLookup).toHaveTextContent("Nearest verified hospitals");
    expect(
      within(communityLookup).queryByText(/Healthcare need rank/i),
    ).not.toBeInTheDocument();
  });

  it("requires Administrator Sign-In before unlocking Admin View controls and supports signing out", async () => {
    render(
      <AppProviders>
        <MapControls />
        <FilterControls />
        <AdminLoginModal />
      </AppProviders>,
    );

    const adminButtons = screen.getAllByRole("button", { name: /Admin View/i });
    fireEvent.click(adminButtons[0]);
    expect(useAppStore.getState().loginModalOpen).toBe(true);
    expect(useAppStore.getState().viewMode).toBe("public");

    fireEvent.change(screen.getByLabelText(/Administrator username/i), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in to Admin View" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid administrator credentials",
      );
    });
    expect(useAppStore.getState().viewMode).toBe("public");

    fireEvent.click(
      screen.getByRole("button", { name: "Fill demo credentials" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in to Admin View" }),
    );

    await waitFor(() => {
      expect(useAppStore.getState().viewMode).toBe("admin");
      expect(useAppStore.getState().adminUser).toBe("admin");
    });

    expect(
      screen.getByRole("navigation", { name: "Planning tools" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Heatmap layer")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(useAppStore.getState().viewMode).toBe("public");
    expect(useAppStore.getState().adminUser).toBeNull();
  });

  it("keeps unapproved drafts isolated from Public View and publishes normal and emergency schedules", () => {
    const today = getManilaToday();
    const tomorrow = addIsoDays(today, 1);
    useAppStore.getState().signInAdmin("admin");

    // Changing clinic count to 5 in Admin View does not mutate today's published 3-clinic schedule
    useAppStore.getState().setClinicCount(5);
    expect(
      useAppStore.getState().publishedSchedules[today].plan.clinics,
    ).toHaveLength(3);

    const fiveClinicPlan = runClinicOptimizer(
      5,
      computeLagunaMunicipalities(emptyScenario()),
      emptyScenario(),
    );

    render(
      <AppProviders>
        <DeploymentApproval plan={fiveClinicPlan} />
        <PublicSidePanel />
      </AppProviders>,
    );

    // Publish 5-clinic schedule for tomorrow
    fireEvent.change(screen.getByLabelText("Opening time"), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByLabelText("Closing time"), {
      target: { value: "16:30" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Approve & publish schedule/i }),
    );

    const tomorrowSchedule =
      useAppStore.getState().publishedSchedules[tomorrow];
    expect(tomorrowSchedule).toBeDefined();
    expect(tomorrowSchedule.plan.clinics).toHaveLength(5);
    expect(tomorrowSchedule.startTime).toBe("09:00");
    expect(tomorrowSchedule.endTime).toBe("16:30");
    expect(tomorrowSchedule.status).toBe("Approved");

    // Publish an emergency schedule override for today with a public notice
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Emergency schedule override/i,
      }),
    );
    fireEvent.change(screen.getByLabelText("Public emergency notice"), {
      target: {
        value:
          "Due to heavy rainfall in lakeside barangays, mobile clinics are relocated to elevated municipal hubs.",
      },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I confirm this emergency revision and public notice/i,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Confirm emergency override/i }),
    );

    const todaySchedule = useAppStore.getState().publishedSchedules[today];
    expect(todaySchedule.status).toBe("Emergency Override");
    expect(todaySchedule.emergencyNotice).toContain(
      "relocated to elevated municipal hubs",
    );
    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("Emergency Schedule Notice");
  });

  it("opens resident-focused clinic details modal in Public View without exposing internal simulation metrics", () => {
    render(
      <AppProviders>
        <PublicSidePanel />
        <ClinicTracker />
      </AppProviders>,
    );

    const viewDetailsButtons = screen.getAllByRole("button", {
      name: "View clinic details",
    });
    fireEvent.click(viewDetailsButtons[0]);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Operating hours (PH Time)");
    expect(dialog).toHaveTextContent("08:00–17:00");
    expect(dialog).toHaveTextContent("Services offered");
    expect(dialog).toHaveTextContent("Assigned communities:");
    expect(dialog).not.toHaveTextContent("Route progress");
  });
});
