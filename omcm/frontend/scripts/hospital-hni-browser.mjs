import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("..", import.meta.url));
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5177",
    "--strictPort",
  ],
  {
    cwd: frontend,
    env: {
      ...process.env,
      VITE_DEMO_MODE: "true",
      VITE_GOOGLE_MAPS_API_KEY: "",
    },
    stdio: "inherit",
  },
);
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Vite exited before browser verification.");
    try {
      if ((await fetch("http://127.0.0.1:5177")).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Vite is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Vite did not become ready within 30 seconds.");
  browser = await chromium.launch({
    headless: true,
    channel: process.env.OMCM_BROWSER_CHANNEL || "chrome",
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("http://127.0.0.1:5177", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".barangay-boundary")).toHaveCount(681);
  await expect(page.locator(".hospital-marker-custom")).toHaveCount(56);
  await expect(page.locator(".hospital-marker-custom svg")).toHaveCount(56);
  await expect(page.locator(".forest-land-area")).toHaveCount(1);
  await expect(page.locator(".forest-land-area")).toHaveAttribute(
    "fill",
    "#d1d5db",
  );
  await expect(page.locator(".forest-land-marker")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Map legend" })).toContainText(
    "Verified hospital",
  );
  await mkdir(`${frontend}/test-results`, { recursive: true });
  // This label extends over the province edge. Raising its pane must not
  // reveal text that the mask was covering in the normal rendering order.
  const forestLabel = page.locator(".forest-land-label");
  const normalLabel = await forestLabel.screenshot({
    animations: "disabled",
    path: `${frontend}/test-results/map-label-over-mask.png`,
  });
  const tooltipPane = page.locator(".leaflet-tooltip-pane");
  const originalZIndex = await tooltipPane.evaluate((pane) => {
    const previous = pane.style.zIndex;
    pane.style.zIndex = "695";
    return previous;
  });
  let raisedLabel;
  try {
    raisedLabel = await forestLabel.screenshot({ animations: "disabled" });
  } finally {
    await tooltipPane.evaluate((pane, previous) => {
      pane.style.zIndex = previous;
    }, originalZIndex);
  }
  expect(
    normalLabel.equals(raisedLabel),
    "Location label text must remain fully visible where it overlaps the province mask",
  ).toBe(true);
  async function verifyMaskDuringDrag(width, height) {
    await page.setViewportSize({ width, height });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".barangay-boundary")).toHaveCount(681);
    const map = page.locator(".leaflet-container");
    const bounds = await map.boundingBox();
    for (const direction of [1, -1]) {
      const pane = map.locator(".leaflet-map-pane");
      const before = await pane.evaluate((element) => element.style.transform);
      // Begin away from floating controls and inspect BEFORE releasing the mouse.
      await page.mouse.move(
        bounds.x + bounds.width * (direction > 0 ? 0.4 : 0.8),
        bounds.y + bounds.height * 0.46,
      );
      await page.mouse.down();
      try {
        await page.mouse.move(
          bounds.x + bounds.width * (direction > 0 ? 0.85 : 0.35),
          bounds.y + bounds.height * (direction > 0 ? 0.76 : 0.16),
          { steps: 15 },
        );
        expect(
          await pane.evaluate((element) => element.style.transform),
        ).not.toBe(before);
        const covered = await map.evaluate((element, direction) => {
          const bounds = element.getBoundingClientRect();
          const point = new DOMPoint(
            direction > 0 ? bounds.left + 8 : bounds.right - 8,
            direction > 0 ? bounds.top + 8 : bounds.bottom - 8,
          );
          return [...element.querySelectorAll("path")].some((path) => {
            if (!["#eaf0f4", "#edf2f5"].includes(path.getAttribute("fill")))
              return false;
            if (Number(path.getAttribute("fill-opacity")) !== 1) return false;
            const svg = path.ownerSVGElement;
            const rect = svg.getBoundingClientRect();
            const unclipped =
              getComputedStyle(svg).overflow === "visible" ||
              (point.x >= rect.left &&
                point.x <= rect.right &&
                point.y >= rect.top &&
                point.y <= rect.bottom);
            return (
              unclipped &&
              path.isPointInFill(
                point.matrixTransform(path.getScreenCTM().inverse()),
              )
            );
          });
        }, direction);
        await page.screenshot({
          path: `${frontend}/test-results/map-mask-held-drag-${width}-${direction}.png`,
        });
        expect(
          covered,
          `Outside Laguna stays masked during held drag (${width}px, ${direction})`,
        ).toBe(true);
      } finally {
        await page.mouse.up();
      }
    }
  }
  await verifyMaskDuringDrag(1440, 1000);
  await verifyMaskDuringDrag(390, 844);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".barangay-boundary")).toHaveCount(681);
  async function verifySearchAlignment(name) {
    const input = page.getByRole("combobox", {
      name: "Find municipality or barangay",
    });
    await input.focus();
    const metrics = await page.locator(".map-search-card").evaluate((card) => {
      const input = card.querySelector("input");
      const bounds = (element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      return {
        card: bounds(card),
        form: bounds(card.querySelector("form")),
        input: bounds(input),
        inputMargin: getComputedStyle(input).margin,
        formAlign: getComputedStyle(card.querySelector("form")).alignItems,
        buttons: [...card.querySelectorAll(".map-icon-button")].map(bounds),
        inputOutline: getComputedStyle(input).outlineStyle,
        cardShadow: getComputedStyle(card).boxShadow,
      };
    });
    expect(metrics.inputOutline).toBe("none");
    expect(metrics.cardShadow).toContain("rgb(26, 115, 232)");
    const center = metrics.card.y + metrics.card.height / 2;
    const controls = [metrics.input, ...metrics.buttons].sort(
      (a, b) => a.x - b.x,
    );
    for (const [index, control] of controls.entries()) {
      expect(control.height).toBe(44);
      expect(
        Math.abs(control.y + control.height / 2 - center),
        JSON.stringify(metrics),
      ).toBeLessThan(0.5);
      expect(control.x).toBeGreaterThanOrEqual(metrics.card.x);
      expect(control.x + control.width).toBeLessThanOrEqual(
        metrics.card.x + metrics.card.width,
      );
      if (index)
        expect(
          controls[index - 1].x + controls[index - 1].width,
        ).toBeLessThanOrEqual(control.x + 0.5);
    }
    await page.screenshot({
      path: `${frontend}/test-results/search-alignment-${name}.png`,
      clip: {
        x: metrics.card.x - 4,
        y: metrics.card.y - 4,
        width: metrics.card.width + 8,
        height: metrics.card.height + 8,
      },
    });
    await input.press("Escape");
  }
  await verifySearchAlignment("public-empty");
  const publicSearch = page.getByRole("combobox", {
    name: "Find municipality or barangay",
  });
  await publicSearch.fill("Pangil");
  await verifySearchAlignment("public-filled");
  await publicSearch.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: /^Pangil Municipality/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `${frontend}/test-results/place-search-dropdown.png`,
  });
  await page.getByRole("option", { name: /^Pangil Municipality/ }).click();
  const publicCare = page.getByRole("complementary", {
    name: "Community care and schedules",
  });
  await expect(
    publicCare.getByRole("heading", { name: "Pangil", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    publicCare.getByRole("region", { name: "Nearby verified hospitals" }),
  ).toBeVisible();
  await expect(
    publicCare.getByRole("meter", { name: "Healthcare need out of 100" }),
  ).toHaveCount(0);
  await expect(
    publicCare.getByRole("region", { name: "Top need contributors" }),
  ).toHaveCount(0);
  const hospitalCard = publicCare
    .getByRole("region", { name: "Nearby verified hospitals" })
    .locator(".place-care-card")
    .first();
  const hospitalSource = hospitalCard.locator(".place-care-source");
  const sourceToggle = hospitalSource.locator("summary");
  await sourceToggle.focus();
  await sourceToggle.press("Enter");
  await expect(hospitalSource).toHaveAttribute("open");
  await expect(hospitalSource.locator("dl")).toBeVisible();
  await expect(hospitalSource).toContainText("Recorded verification");
  await expect(hospitalSource).toContainText(
    "DOH hospital register, June 2026",
  );
  await expect(hospitalSource).toContainText("Bed-count basis");
  await expect(hospitalSource).toContainText(
    "DOH authorized bed capacity (ABC)",
  );
  await expect(hospitalSource.locator("time")).toHaveAttribute(
    "datetime",
    "2026-06-30",
  );
  await expect(hospitalSource).toContainText(
    "published authorized beds; see source date",
  );
  await hospitalSource.screenshot({
    path: `${frontend}/test-results/hospital-source-open-desktop.png`,
    animations: "disabled",
  });
  await sourceToggle.press("Space");
  await expect(hospitalSource).not.toHaveAttribute("open");
  await expect(hospitalSource.locator("dl")).not.toBeVisible();
  await hospitalSource.screenshot({
    path: `${frontend}/test-results/hospital-source-closed-desktop.png`,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Expand place details" }).click();
  await sourceToggle.focus();
  await sourceToggle.press("Enter");
  await expect(hospitalSource.locator("dl")).toBeVisible();
  const sourceBounds = await hospitalSource.boundingBox();
  const hospitalBounds = await hospitalCard.boundingBox();
  expect(sourceBounds.x).toBeGreaterThanOrEqual(hospitalBounds.x);
  expect(sourceBounds.x + sourceBounds.width).toBeLessThanOrEqual(
    hospitalBounds.x + hospitalBounds.width,
  );
  expect(
    await hospitalSource.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await hospitalSource.screenshot({
    path: `${frontend}/test-results/hospital-source-open-mobile.png`,
    animations: "disabled",
  });
  await sourceToggle.press("Space");
  await expect(hospitalSource).not.toHaveAttribute("open");
  await page.getByRole("button", { name: "Collapse place details" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: `${frontend}/test-results/place-public-details.png`,
  });

  await page
    .getByRole("button", { name: "Admin View", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Use demo sign-in details" }).click();
  await page.getByRole("button", { name: "Sign in to Admin View" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/is-admin-view/);
  const search = page.getByRole("combobox", {
    name: "Find municipality or barangay",
  });
  await page.getByRole("button", { name: "Clear municipality search" }).click();
  await verifySearchAlignment("admin-empty");
  await search.fill("Pangil");
  await verifySearchAlignment("admin-filled");
  await search.press("ArrowDown");
  await page.getByRole("option", { name: /^Pangil Municipality/ }).click();
  const selection = page.getByRole("region", { name: "Selected place" });
  await expect(selection).toContainText(
    "No hospital records in Pangil in this dataset.",
  );
  const selectedOutline = page.locator(".municipality-boundary.is-selected");
  await expect(selectedOutline).toHaveCount(1);
  await expect(selectedOutline).toHaveAttribute("stroke", "#1a73e8");
  await expect(selectedOutline).toHaveAttribute("stroke-width", "5");
  const anchoredSearch = await page.locator(".map-search-card").boundingBox();
  await expect(page.locator(".map-search-card")).toHaveCSS("position", "fixed");
  const selectedBounds = await selectedOutline.boundingBox();
  await selection
    .getByRole("button", { name: "Show all 56 hospitals" })
    .click();
  await expect(page.locator(".hospital-marker-custom")).toHaveCount(56);
  await expect
    .poll(async () => (await selectedOutline.boundingBox()).width)
    .toBeLessThan(selectedBounds.width);
  await search.press("Enter");
  await expect
    .poll(async () => (await selectedOutline.boundingBox()).width)
    .toBeCloseTo(selectedBounds.width, 0);
  const searchAfterRefocus = await page
    .locator(".map-search-card")
    .boundingBox();
  expect(searchAfterRefocus.x).toBe(anchoredSearch.x);
  expect(searchAfterRefocus.y).toBe(anchoredSearch.y);
  const summary = page.getByRole("region", {
    name: "Municipality healthcare need",
    exact: true,
  });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Some data is missing in 2 barangays");
  const expected = await page.evaluate(async () => {
    const data = await import("/src/services/providedData.ts");
    const barangay = data.LAGUNA_BARANGAYS.find(
      (b) => b.name === "Dambo" && b.municipality === "Pangil",
    );
    const municipality = data.MUNICIPALITY_HEALTHCARE_NEED.get(
      barangay.municipalityPsgc,
    );
    return {
      barangay,
      municipality,
      scores: data.LAGUNA_BARANGAYS.map((b) => ({
        psgc: b.psgc,
        score: b.needScore,
      })),
    };
  });
  await expect(summary).toContainText(
    expected.municipality.needScore.toFixed(1),
  );
  await expect(summary).toContainText(
    `Municipality rank #${expected.municipality.needRank} of 30`,
  );
  const scoreColor = (value) =>
    value >= 70
      ? "#7f1d1d"
      : value >= 50
        ? "#b91c1c"
        : value >= 35
          ? "#ef4444"
          : value >= 20
            ? "#f87171"
            : "#fee2e2";
  const scores = new Map(expected.scores.map((b) => [b.psgc, b.score]));
  const colors = await page.locator(".barangay-boundary").evaluateAll((paths) =>
    paths.map((path) => ({
      psgc: path.getAttribute("data-barangay-psgc"),
      fill: path.getAttribute("fill"),
    })),
  );
  for (const polygon of colors)
    expect(polygon.fill, polygon.psgc).toBe(
      scoreColor(scores.get(polygon.psgc)),
    );

  await page.getByLabel("Find a barangay in this list").fill("Dambo");
  await page.getByRole("button", { name: /^Rank \d+: Dambo, Pangil/ }).click();
  const detail = page.getByRole("region", {
    name: "Barangay healthcare need",
    exact: true,
  });
  await expect(
    detail.getByRole("meter", {
      name: "Healthcare need out of 100",
      exact: true,
    }),
  ).toHaveAttribute("value", String(expected.barangay.needScore));
  await expect(detail).toContainText("Share of score factors available85%");
  await expect(detail).toContainText(expected.barangay.nearestHospital.name);
  await expect(detail).toContainText(
    `${expected.barangay.nearestHospital.distanceKm.toFixed(2)} km straight-line distance`,
  );
  await expect(
    detail
      .getByRole("region", { name: "Top need contributors" })
      .getByRole("meter"),
  ).toHaveCount(3);
  const factorDisclosure = detail.locator("details").filter({
    has: page.locator("summary", {
      hasText: /^How each factor affects the score/,
    }),
  });
  await expect(factorDisclosure).not.toHaveAttribute("open");
  await factorDisclosure.locator("summary").click();
  await expect(factorDisclosure).toHaveAttribute("open");
  await expect(factorDisclosure).toContainText("Distance to a hospital");
  await factorDisclosure.locator("summary").click();
  await page
    .getByRole("complementary", { name: "Barangay details" })
    .locator(".workspace-panel-body")
    .evaluate((element) => {
      element.scrollTop = 0;
    });
  await page.screenshot({
    path: `${frontend}/test-results/place-barangay-details.png`,
  });
  await expect(selection).toContainText("Dambo, Pangil");
  await expect(selection).toContainText("Nearest: 4.56 km straight line");
  await page.getByRole("button", { name: "Close community details" }).click();
  await expect(selection).toBeVisible();
  await expect(selectedOutline).toHaveAttribute("stroke", "#1a73e8");
  await selection
    .getByRole("button", { name: "Open selected place details" })
    .click();
  await expect(detail).toBeVisible();

  // Retained historical records are inspectable without appearing as care locations.
  await search.fill("City of Calamba");
  await page.getByRole("option", { name: /^City of Calamba City/ }).click();
  await page
    .getByRole("region", { name: "Barangay healthcare need ranking" })
    .getByRole("button", { name: /^Rank \d+:/ })
    .first()
    .click();
  const register = page.locator("details").filter({
    has: page.locator("summary", { hasText: /^Hospital register in/ }),
  });
  await register.locator("summary").click();
  await expect(register).toContainText("SAN JOSE HOSPITAL AND MEDICAL CENTER");
  await expect(register).toContainText(
    "reported closed; retained as a historical mapped hospital",
  );
  await expect(page.locator(".hospital-marker-custom")).toHaveCount(56);

  await search.fill("Pangil");
  await page.getByRole("option", { name: /^Pangil Municipality/ }).click();
  await mkdir(`${frontend}/test-results`, { recursive: true });
  await page.screenshot({
    path: `${frontend}/test-results/hospital-hni-desktop.png`,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await verifySearchAlignment("mobile-390");
  await page.setViewportSize({ width: 320, height: 740 });
  await verifySearchAlignment("mobile-320");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(selection).toBeVisible();
  const mobileSearch = await page.locator(".map-search-card").boundingBox();
  expect(mobileSearch.x).toBe(12);
  expect(mobileSearch.y).toBe(12);
  const mobileSelection = await selection.boundingBox();
  const mobilePanel = await page
    .getByRole("complementary", { name: "Municipality details" })
    .boundingBox();
  expect(mobileSelection.y + mobileSelection.height).toBeLessThanOrEqual(
    mobilePanel.y,
  );
  const mobileLegend = await page
    .getByRole("region", { name: "Map legend" })
    .boundingBox();
  expect(mobilePanel.y + mobilePanel.height).toBeLessThanOrEqual(
    mobileLegend.y,
  );
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(
    expected.municipality.needScore.toFixed(1),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${frontend}/test-results/hospital-hni-mobile.png`,
  });
  await page.getByRole("button", { name: "Expand place details" }).click();
  const expandedPanel = await page
    .getByRole("complementary", { name: "Municipality details" })
    .boundingBox();
  expect(expandedPanel.height).toBeGreaterThan(mobilePanel.height);
  await expect(selection).not.toBeVisible();
  await page.screenshot({
    path: `${frontend}/test-results/place-details-mobile-expanded.png`,
  });
  await page.getByRole("button", { name: "Collapse place details" }).click();
  await expect(selection).toBeVisible();
  await page.getByRole("button", { name: "Plan clinics", exact: true }).click();
  const planner = page.getByRole("complementary", {
    name: "Plan clinic locations",
    exact: true,
  });
  await expect(planner).toBeVisible();
  await expect(planner).toContainText("Los Baños–Bay · 20-barangay pilot");
  await expect(
    planner.getByRole("region", { name: "Backend allocation results" }),
  ).toHaveCount(0);
  // This explicit browser-demo suite verifies the map and the empty planner.
  // The connected suite generates real allocations with its isolated backend.
  await page
    .getByRole("button", { name: "30-day simulation", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Try a 30-day clinic plan" }),
  ).toBeVisible();
  await expect(selection).not.toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "Hospital/HNI and search browser checks passed: labels above the province mask, opaque mask during held desktop/mobile drags, 681 polygons, 56 hospitals, fixed search, repeated refocus, blue municipality selection, scoped hospital counts, matching HNI, desktop/mobile without selection-panel or legend overlap, no page errors.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
