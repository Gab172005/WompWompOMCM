import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const frontend = fileURLToPath(new URL("../../frontend", import.meta.url));
const require = createRequire(resolve(frontend, "package.json"));
const { chromium, expect } = require("@playwright/test");
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5176", "--strictPort"], {
  cwd: frontend, env: { ...process.env, VITE_DEMO_MODE: "true" }, stdio: "pipe",
});
let browser, log = "";
server.stdout.on("data", (data) => log += data);
server.stderr.on("data", (data) => log += data);
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(log);
    try { if ((await fetch("http://127.0.0.1:5176")).ok) break; } catch {}
    await new Promise((done) => setTimeout(done, 250));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.OMCM_BROWSER_CHANNEL ? { channel: process.env.OMCM_BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Geometry and local datasets must work independently of external basemap tiles.
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("http://127.0.0.1:5176");
  await expect(page.locator(".barangay-boundary")).toHaveCount(681);
  await expect(page.locator(".municipality-boundary")).toHaveCount(30);
  await expect(page.getByLabel("Map legend")).toContainText("Disaster risk index");
  await expect(page.locator(".hospital-marker-custom")).toHaveCount(61);
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
  await page.getByRole("checkbox", { name: "Hospitals", exact: true }).uncheck();
  await expect(page.locator(".hospital-marker-custom")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Hospitals", exact: true }).check();
  await page.keyboard.press("Escape");
  await search.fill("Dambo");
  await page.getByRole("option", { name: /Dambo, Pangil/ }).click();
  await expect(panel).toContainText("Needs review");
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
  await expect(page.locator(".leaflet-zoom-anim")).toHaveCount(0);
  await page.waitForTimeout(500);
  const panelBox = await panel.boundingBox();
  const legendBox = await page.getByLabel("Map legend").boundingBox();
  const selectionBox = await page.locator(".barangay-boundary.is-selected").boundingBox();
  if (selectionBox.y + selectionBox.height > panelBox.y) throw new Error("Selected barangay is hidden behind the mobile panel");
  if (panelBox.y + panelBox.height > legendBox.y) throw new Error("Legend overlaps barangay details");
  await page.screenshot({ path: resolve(frontend, "test-results/barangay-mobile.png") });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Mobile page overflows horizontally");
  await page.getByRole("button", { name: "Close intelligence panel" }).click();
  await expect(panel).toHaveCount(0);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Barangay browser checks passed: boundaries, pointer selection, highlight, source details, filters, missing/zero risk, hospital toggle, municipality return, mobile layout and close.");
} finally {
  await browser?.close();
  server.kill();
}
