import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const frontend = fileURLToPath(new URL("../../frontend", import.meta.url));
const require = createRequire(resolve(frontend, "package.json"));
const { chromium, expect } = require("@playwright/test");
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5176", "--strictPort"], {
  cwd: frontend, env: { ...process.env, VITE_DEMO_MODE: "true" }, stdio: "inherit",
});
let browser;
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite exited with code ${server.exitCode}; see inherited server output.`);
    try { if ((await fetch("http://127.0.0.1:5176")).ok) break; } catch {}
    await new Promise((done) => setTimeout(done, 250));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.OMCM_BROWSER_CHANNEL ? { channel: process.env.OMCM_BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Geometry and local datasets must work independently of external basemap tiles.
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  // A cold Vite transform of the province bundle can exceed the default 30 s;
  // wait for the app's actual geometry readiness, not external tile loading.
  await page.goto("http://127.0.0.1:5176", { waitUntil: "domcontentloaded", timeout: 120000 });
  await expect(page.locator(".barangay-boundary")).toHaveCount(681, { timeout: 90000 });
  await expect(page.locator(".municipality-boundary")).toHaveCount(30);
  await expect(page.getByLabel("Map legend")).toContainText("Approved Care Locations");
  await expect(page.locator(".hospital-marker-custom")).toHaveCount(61);
  // Independently derive layer eligibility from the audit register, not the
  // exported map array, so incorrect production filtering cannot bless itself.
  const clinicState = await page.evaluate(async () => {
    const { PROVIDED_OSM_CLINICS, MAPPED_OSM_CLINICS, OSM_CLINIC_SNAPSHOT } = await import("/src/services/providedData.ts");
    const eligible = PROVIDED_OSM_CLINICS.filter((c) => c.active && c.inProvince && c.assignmentStatus !== "outside" && c.assignmentStatus !== "unlocated" && typeof c.lat === "number" && Number.isFinite(c.lat) && Math.abs(c.lat) <= 90 && typeof c.lng === "number" && Number.isFinite(c.lng) && Math.abs(c.lng) <= 180);
    return { count: eligible.length, actualIds: MAPPED_OSM_CLINICS.map((c) => c.id).sort(), expectedIds: eligible.map((c) => c.id).sort(), valid: OSM_CLINIC_SNAPSHOT.valid };
  });
  expect(clinicState.valid).toBe(true);
  expect(clinicState.count).toBeGreaterThan(0);
  expect(clinicState.actualIds).toEqual(clinicState.expectedIds);
  await expect(page.locator(".osm-clinic-marker-custom")).toHaveCount(clinicState.count);
  await expect(page.getByRole("navigation", { name: "Planning tools" })).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle intelligence panel", exact: true }).click();
  const publicPanel = page.getByRole("complementary", { name: "Community care and schedules" });
  await expect(publicPanel).toContainText("Approved Mobile Clinics (3)");
  await expect(publicPanel).toContainText("Public Health Advisories");
  await mkdir(resolve(frontend, "test-results"), { recursive: true });
  await page.screenshot({ path: resolve(frontend, "test-results/public-view-desktop.png") });
  await page.getByRole("button", { name: "Close intelligence panel", exact: true }).click();
  await page.getByRole("button", { name: "Admin View" }).first().click();
  await page.getByRole("button", { name: "Fill demo credentials", exact: true }).click();
  await page.getByRole("button", { name: "Sign in to Admin View", exact: true }).click();
  await expect(page.getByLabel("Map legend")).toContainText("Healthcare need");
  const ranked = await page.evaluate(async () => {
    const { RANKED_BARANGAYS } = await import("/src/services/providedData.ts");
    return RANKED_BARANGAYS.map((b) => ({ psgc: b.psgc, name: b.name, municipality: b.municipality, score: b.needScore, rank: b.needRank }));
  });
  await page.getByRole("button", { name: "Toggle intelligence panel", exact: true }).click();
  const ranking = page.getByRole("region", { name: "Barangay healthcare need ranking", exact: true });
  await expect(ranking.getByRole("listitem")).toHaveCount(25);
  await ranking.getByRole("button", { name: "Next ranks", exact: true }).click();
  await expect(ranking.getByRole("status")).toHaveText("26–50 of 681");
  const top = ranked[0];
  await ranking.getByLabel("Filter barangay ranking").fill(`${top.name} ${top.municipality}`);
  await ranking.getByRole("button", { name: new RegExp(`^Rank ${top.rank}:`) }).click();
  const healthcareNeed = page.getByRole("region", { name: "Barangay healthcare need", exact: true });
  await expect(healthcareNeed).toContainText(`Healthcare need rank #${top.rank} of 681`);
  await expect(healthcareNeed).toContainText(top.score.toFixed(1));
  await expect(healthcareNeed).toContainText("Municipality income class · 10% base weight");
  await expect(healthcareNeed).toContainText("Clinic distance · 5% base weight");
  await expect(healthcareNeed).toContainText("Clinic provision deficit · 5% base weight");
  await expect(healthcareNeed).toContainText("demographic context, not scored");
  await expect(healthcareNeed).not.toContainText("Urban / rural classification · 10% base weight");
  await expect(healthcareNeed).toContainText("resource proxy");
  await expect(page.locator(".workspace-panel-body")).toHaveJSProperty("scrollTop", 0);
  await expect(page.locator(".barangay-boundary.is-selected")).toHaveCount(1);
  await mkdir(resolve(frontend, "test-results"), { recursive: true });
  await page.screenshot({ path: resolve(frontend, "test-results/healthcare-need-desktop.png") });
  const search = page.getByLabel("Find municipality or barangay");
  await search.fill("Alaminos");
  await page.getByRole("option", { name: /^Alaminos Municipality/ }).click();
  await expect(page.getByRole("heading", { name: "Alaminos", exact: true })).toBeVisible();
  await expect(page.locator(".leaflet-zoom-anim")).toHaveCount(0);
  await page.waitForTimeout(500);
  const polygon = page.getByRole("button", { name: "Select Barangay I, Alaminos", exact: true });
  const point = await polygon.evaluate((path) => {
    const box = path.getBBox();
    for (const row of [10, 9, 11, 8, 12, 7, 13, 6, 14, 5, 15, 4, 16, 3, 17, 2, 18, 1, 19]) for (const column of [10, 9, 11, 8, 12, 7, 13, 6, 14, 5, 15, 4, 16, 3, 17, 2, 18, 1, 19]) {
      const point = new DOMPoint(box.x + box.width * column / 20, box.y + box.height * row / 20);
      if (path.isPointInFill(point)) {
        const screen = point.matrixTransform(path.getScreenCTM());
        return { x: screen.x, y: screen.y };
      }
    }
    throw new Error("No interior point for the barangay polygon");
  });
  await page.mouse.click(point.x, point.y);
  const panel = page.getByLabel("Barangay intelligence", { exact: true });
  await expect(panel).toContainText("Barangay I");
  const selectedNeed = ranked.find((b) => b.name === "Barangay I" && b.municipality === "Alaminos");
  await expect(healthcareNeed).toContainText(`Healthcare need rank #${selectedNeed.rank} of 681`);
  await expect(healthcareNeed).toContainText(selectedNeed.score.toFixed(1));
  await expect(panel).toContainText("2,519");
  await expect(panel).toContainText("66.67");
  await expect(polygon).toHaveAttribute("aria-pressed", "true");
  await expect(polygon).toHaveAttribute("fill", "#facc15");
  await expect(page.locator(".barangay-boundary.is-selected")).toHaveCount(1);
  await mkdir(resolve(frontend, "test-results"), { recursive: true });
  await page.screenshot({ path: resolve(frontend, "test-results/barangay-desktop.png") });
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await page.getByLabel("Heatmap layer").selectOption("density");
  await expect(polygon).toHaveAttribute("fill", "#facc15");
  await page.getByLabel("Heatmap layer").selectOption("disasterRisk");
  const osmToggle = page.getByRole("checkbox", { name: "OSM clinics", exact: true });
  const mobileToggle = page.getByRole("checkbox", { name: "Mobile clinics", exact: true });
  const mobileCount = await page.locator(".clinic-staging-marker").count();
  await osmToggle.uncheck();
  await expect(page.locator(".osm-clinic-marker-custom")).toHaveCount(0);
  await expect(page.locator(".hospital-marker-custom")).toHaveCount(61);
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(mobileCount);
  await osmToggle.check();
  await expect(page.locator(".osm-clinic-marker-custom")).toHaveCount(clinicState.count);
  await mobileToggle.uncheck();
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(0);
  await expect(page.locator(".osm-clinic-marker-custom")).toHaveCount(clinicState.count);
  await mobileToggle.check();
  await page.getByRole("checkbox", { name: "Hospitals", exact: true }).uncheck();
  await expect(page.locator(".hospital-marker-custom")).toHaveCount(0);
  await expect(page.locator(".osm-clinic-marker-custom")).toHaveCount(clinicState.count);
  await page.getByRole("checkbox", { name: "Hospitals", exact: true }).check();
  await page.keyboard.press("Escape");
  await search.fill("Dambo");
  await page.getByRole("option", { name: /Dambo, Pangil/ }).click();
  await expect(panel).toContainText("Needs review");
  await expect(healthcareNeed).toContainText("Provisional score and rank · 85%");
  await expect(panel).toContainText("0–100/100");
  await expect(polygon).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".barangay-boundary.is-selected")).toHaveCount(1);
  const data = JSON.parse(await readFile(resolve(frontend, "src/data/laguna-datasets.json"), "utf8"));
  const zero = data.barangays.find((b) => b.disasterRisk === 0);
  await search.fill(`${zero.name}, ${zero.municipality}`);
  await page.getByRole("option", { name: new RegExp(`${zero.name}, ${zero.municipality}`) }).click();
  await expect(panel).toContainText("No mapped hazard at query point");
  await expect(panel).toContainText("does not establish that the barangay is safe");
  await page.getByRole("button", { name: "Municipality overview" }).click();
  await expect(page.locator(".barangay-boundary.is-selected")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await search.fill("Dambo");
  await page.getByRole("option", { name: /Dambo, Pangil/ }).click();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Dambo", exact: true })).toBeVisible();
  await expect(healthcareNeed).toContainText("Healthcare need rank #");
  await expect(healthcareNeed).toContainText("Provisional score and rank");
  await expect(page.locator(".leaflet-zoom-anim")).toHaveCount(0);
  await page.waitForTimeout(500);
  const panelBox = await panel.boundingBox();
  const legendBox = await page.getByLabel("Map legend").boundingBox();
  const selectionBox = await page.locator(".barangay-boundary.is-selected").boundingBox();
  if (selectionBox.width <= 0 || selectionBox.height <= 0 || selectionBox.x < 0 || selectionBox.x + selectionBox.width > 390 || selectionBox.y < 125) throw new Error("Selected barangay is outside the visible mobile map");
  if (selectionBox.y + selectionBox.height > panelBox.y) throw new Error("Selected barangay is hidden behind the mobile panel");
  if (panelBox.y + panelBox.height > legendBox.y) throw new Error("Legend overlaps barangay details");
  await page.screenshot({ path: resolve(frontend, "test-results/barangay-mobile.png") });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Mobile page overflows horizontally");
  await page.getByRole("button", { name: "Close intelligence panel" }).click();
  await expect(panel).toHaveCount(0);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Barangay browser checks passed: boundaries, pointer selection, highlight, source details, filters, missing/zero risk, independent OSM/hospital/mobile toggles, municipality return, healthcare need scores, provincial ranking/filter/pagination, provisional ranks, mobile layout and close.");
} finally {
  await browser?.close();
  server.kill();
}
