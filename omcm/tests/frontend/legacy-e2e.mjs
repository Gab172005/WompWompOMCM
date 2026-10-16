import { createRequire } from "node:module";
const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

const temp = await mkdtemp(join(tmpdir(), "omcm-fleet-e2e-"));
const password = randomBytes(24).toString("base64url"),
  username = "browser-test-admin";
const backend = resolve("../backend");
const python = join(
  backend,
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python",
);
const processes = [],
  errors = [];
let browser, page;
function start(command, args, cwd, env = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  child.on("error", (e) => (log += e.message));
  processes.push(child);
  return { child, log: () => log };
}
async function ready(url, server) {
  for (let i = 0; i < 100; i++) {
    if (server.child.exitCode !== null) throw new Error(server.log());
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server timeout: ${server.log()}`);
}
async function screenshot(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
}
const positions = () =>
  page
    .locator(".fleet-card")
    .evaluateAll((cards) => cards.map((c) => [c.dataset.lng, c.dataset.lat]));
async function seek(seconds) {
  await page
    .getByRole("slider", { name: "Deployment timeline", exact: true })
    .fill(String(seconds));
}
async function inspectPolygon() {
  const point = await page.locator("path.area-403411000").evaluate((path) => {
    const b = path.getBBox();
    for (const x of [0.5, 0.35, 0.65, 0.2, 0.8])
      for (const y of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const p = new DOMPoint(b.x + b.width * x, b.y + b.height * y);
        if (path.isPointInFill(p)) {
          const q = p.matrixTransform(path.getScreenCTM());
          if (document.elementFromPoint(q.x, q.y) === path)
            return { x: q.x, y: q.y };
        }
      }
    throw new Error("No polygon interior found");
  });
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".map-detail")).toContainText("Los Baños");
  await expect(page.locator(".map-detail")).toContainText(
    "available barangay records",
  );
  await expect(page.locator(".map-detail")).toContainText(
    /score contributions/i,
  );
  await page
    .getByRole("button", { name: "Close municipality details" })
    .click();
  await page.getByRole("searchbox", { name: "Municipality search" }).fill("Alaminos");
  await page.getByRole("button", { name: "Alaminos", exact: true }).click();
  await expect(page.locator(".map-detail")).toContainText("Alaminos");
  await expect(page.locator(".map-detail .detail-score")).toHaveText("No data");
  await page
    .getByRole("button", { name: "Close municipality details" })
    .click();
}
async function verifyFleet() {
  await expect(page.locator(".fleet-card")).toHaveCount(3);
  await expect(page.locator(".fleet-marker")).toHaveCount(3);
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  if (await pause.count()) await pause.click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  const origin = await positions();
  await seek(70);
  const initial = await positions();
  await page
    .getByRole("combobox", { name: "Simulation speed" })
    .selectOption("5");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.waitForTimeout(700);
  await pause.click();
  const moved = await positions();
  assert.notDeepEqual(moved, initial);
  const paused = await positions();
  await page.waitForTimeout(400);
  assert.deepEqual(await positions(), paused);
  await seek(100);
  const at100 = await positions();
  await seek(50);
  assert.notDeepEqual(await positions(), at100);
  await seek(100);
  assert.deepEqual(await positions(), at100);
  await page
    .getByRole("combobox", { name: "Simulation speed" })
    .selectOption("60");
  await seek(100);
  assert.deepEqual(await positions(), at100);
  const end = await page
    .getByRole("slider", { name: "Deployment timeline", exact: true })
    .getAttribute("max");
  await seek(end);
  await expect(page.locator(".fleet-status.deployed")).toHaveCount(3);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  assert.deepEqual(await positions(), origin);
}
async function verifyConsecutiveDays() {
  const day = page.getByTestId("simulation-day");
  const timeline = page.getByRole("slider", {
    name: "Deployment timeline",
    exact: true,
  });
  const reset = page.getByRole("button", { name: "Reset", exact: true });
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  await expect(day).toHaveAttribute("data-day", "1");
  // A mid-route click must carry the final positions, not the cursor positions.
  await seek(await timeline.getAttribute("max"));
  const finalToday = await positions();
  await seek(70);
  assert.notDeepEqual(await positions(), finalToday);
  await page.getByRole("button", { name: "Reoptimize tomorrow" }).click();
  await expect(day).toHaveAttribute("data-day", "2");
  await expect(pause).toBeVisible();
  await pause.click();
  await reset.click();
  assert.deepEqual(await positions(), finalToday);
  await expect(page.locator(".fleet-status.deployed")).toHaveCount(3);
  await expect(page.locator(".fleet-card").first()).not.toContainText(
    "Timugan depot →",
  );

  // Force a different assignment, then verify real travel from the retained sites.
  await page
    .getByText("Need weights & site exclusions", { exact: true })
    .click();
  const currentName = await page
    .locator(".fleet-card > span")
    .first()
    .textContent();
  await page.getByLabel(`Exclude ${currentName}`, { exact: true }).check();
  await page.getByRole("button", { name: "Reoptimize tomorrow" }).click();
  await expect(day).toHaveAttribute("data-day", "3");
  await expect(pause).toBeVisible();
  await pause.click();
  await reset.click();
  assert.deepEqual(await positions(), finalToday);
  const finalDayTwo = finalToday;
  await seek(await timeline.getAttribute("max"));
  const finalDayThree = await positions();
  assert.notDeepEqual(finalDayThree, finalDayTwo);
  await expect(page.locator(".fleet-status.deployed")).toHaveCount(3);
  await reset.click();
  assert.deepEqual(await positions(), finalDayTwo);

  // Baseline preview is a comparison; it must not become tomorrow's fleet history.
  await page.getByLabel("Compare baseline routes", { exact: true }).check();
  await page.getByRole("button", { name: "Reoptimize tomorrow" }).click();
  await expect(day).toHaveAttribute("data-day", "4");
  await expect(pause).toBeVisible();
  await pause.click();
  await reset.click();
  assert.deepEqual(await positions(), finalDayThree);
  await expect(
    page.getByLabel("Compare baseline routes", { exact: true }),
  ).not.toBeChecked();
  await page.getByRole("link", { name: "Data & Methods", exact: true }).click();
  await page.getByRole("link", { name: "Simulator", exact: true }).click();
  await expect(day).toHaveAttribute("data-day", "4");
  await expect(page.locator(".fleet-marker")).toHaveCount(3);
  assert.deepEqual(await positions(), finalDayThree);
  await screenshot("simulator-next-day");
  // The explicit demo tour is the only action here that begins again at the depot.
  await page.getByRole("button", { name: "Demo tour · 3 clinics" }).click();
  await expect(day).toHaveAttribute("data-day", "1");
  await pause.click();
  await reset.click();
  assert.notDeepEqual(await positions(), finalDayThree);
}
try {
  const apiServer = start(
    python,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001"],
    backend,
    {
      OMCM_DATABASE_PATH: join(temp, "test.db"),
      OMCM_DEMO_AUTH: "true",
      OMCM_ADMIN_USERNAME: username,
      OMCM_ADMIN_PASSWORD: password,
      OMCM_DATASET: "pilot",
    },
  );
  const vite = start(
    process.execPath,
    [
      resolve("node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "5174",
      "--strictPort",
    ],
    process.cwd(),
    {
      OMCM_PROXY_TARGET: "http://127.0.0.1:8001",
      VITE_API_URL: "",
      VITE_DEMO_MODE: "false",
    },
  );
  await Promise.all([
    ready("http://127.0.0.1:8001/api/health", apiServer),
    ready("http://127.0.0.1:5174", vite),
  ]);
  browser = await chromium.launch(
    process.platform === "win32"
      ? { channel: "msedge", headless: true }
      : { headless: true },
  );
  page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  page.setDefaultTimeout(30000);
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  await page.goto("http://127.0.0.1:5174/driver");
  await expect(
    page.getByRole("heading", { name: "Care on the move" }),
  ).toBeVisible();
  await expect(page.locator("path.municipality-marker")).toHaveCount(30);
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await inspectPolygon();
  await page.getByLabel("Need polygons", { exact: true }).uncheck();
  await expect(page.locator("path.area-403411000")).toHaveAttribute(
    "fill-opacity",
    "0",
  );
  await expect(page.locator("path.area-403411000")).toHaveAttribute(
    "stroke-width",
    "1.8",
  );
  await page.getByLabel("Need polygons", { exact: true }).check();
  await screenshot("municipality-map");
  // A credential-free read-only tour works while server publishing remains protected.
  await page.getByRole("button", { name: "Demo tour · 3 clinics" }).click();
  await verifyFleet();
  await page
    .getByRole("button", { name: "Sign in & generate approval draft" })
    .click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Review & approve plan" }),
  ).toBeVisible();
  await verifyFleet();
  await verifyConsecutiveDays();
  await seek(100);
  // Failed server requests must preserve the day and the exact paused position.
  const failedPosition = await positions();
  const rejectOptimize = (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Simulated optimizer outage" }),
    });
  await page.route("**/api/optimize", rejectOptimize);
  await page.getByRole("button", { name: "Reoptimize tomorrow" }).click();
  await expect(
    page.getByText("Simulated optimizer outage", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("simulation-day")).toHaveAttribute(
    "data-day",
    "1",
  );
  assert.deepEqual(await positions(), failedPosition);
  await page.unroute("**/api/optimize", rejectOptimize);
  await screenshot("simulator-desktop");
  await page.getByRole("link", { name: "Review & approve plan" }).click();
  await page
    .getByRole("button", { name: "Approve and publish", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Deployment approved" }),
  ).toBeVisible();
  const tomorrow = await page
    .getByLabel("Deployment date", { exact: true })
    .inputValue();
  const published = await (
    await fetch("http://127.0.0.1:8001/api/schedules")
  ).json();
  assert.equal(published.schedules.length, 1);
  await page.getByRole("link", { name: "Simulator", exact: true }).click();
  const beforeSites = await page.locator(".site-focus").allTextContents();
  await page.getByLabel("Flood level", { exact: true }).selectOption("severe");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reoptimize tomorrow" }).click();
  await expect(page.locator(".site-focus").first()).toBeVisible();
  await expect
    .poll(() => page.locator(".site-focus").allTextContents())
    .not.toEqual(beforeSites);
  await screenshot("simulator-severe-flood");
  await page.getByLabel("Available clinics", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Reoptimize tomorrow" }).click();
  await expect(page.locator(".fleet-card")).toHaveCount(2);
  assert.deepEqual(
    await (await fetch("http://127.0.0.1:8001/api/schedules")).json(),
    published,
  );
  await page
    .getByRole("button", { name: "Reset scenario", exact: true })
    .click();
  await expect(page.getByLabel("Flood level", { exact: true })).toHaveValue(
    "none",
  );
  await expect(
    page.getByLabel("Available clinics", { exact: true }),
  ).toHaveValue("3");
  await page.getByRole("button", { name: "Reoptimize tomorrow" }).click();
  await expect(page.locator(".fleet-card")).toHaveCount(3);
  await page.getByRole("link", { name: "Data & Methods", exact: true }).click();
  const recalculated = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/risk/calculate") &&
      r.request().method() === "POST" &&
      JSON.parse(r.request().postData()).disease === 31,
  );
  await page
    .getByRole("slider", { name: /Disease burden/ })
    .press("ArrowRight");
  assert.equal((await (await recalculated).json()).weights.disease, 31);
  await page.getByRole("link", { name: "Simulator", exact: true }).click();
  await page.getByRole("button", { name: "Demo tour · 3 clinics" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await seek(100);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await screenshot("simulator-mobile");
  await page.goto("http://127.0.0.1:5174/public");
  await expect(page.locator("path.municipality-marker")).toHaveCount(30);
  await page.getByLabel("Schedule date").fill(tomorrow);
  await expect(page.locator(".public-clinic")).toHaveCount(3);
  assert.equal(await page.locator(".fleet-marker").count(), 0);
  await expect(page.getByText(/Last updated:/)).toBeVisible();
  await screenshot("public-mobile");
  // Separate browser context proves the static frontend works with every API request failing.
  const offline = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  page = await offline.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("http://127.0.0.1:5174/driver");
  await expect(page.locator(".browser-demo-banner")).toBeVisible();
  await page.getByRole("button", { name: "Demo tour · 3 clinics" }).click();
  await verifyFleet();
  await verifyConsecutiveDays();
  await seek(100);
  await screenshot("simulator-browser-demo");
  await page.getByRole("link", { name: "Review & approve plan" }).click();
  await page
    .getByRole("button", { name: "Approve and publish", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Deployment approved" }),
  ).toBeVisible();
  const localTomorrow = await page
    .getByLabel("Deployment date", { exact: true })
    .inputValue();
  await page.goto("http://127.0.0.1:5174/public");
  await page.getByLabel("Schedule date").fill(localTomorrow);
  await expect(page.locator(".public-clinic")).toHaveCount(3);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: actual basemap, 20 real polygons, inspection, road-following vehicles, playback controls, consecutive days with retained positions and automatic playback, stationary assignments, baseline isolation, failed-request preservation, authenticated approval, flood/shortage replanning, public isolation, weight changes, 1440px/390px screenshots, standalone browser demo, and no uncaught browser errors.",
  );
} catch (error) {
  if (page) await screenshot("failure");
  console.error("Browser errors:", errors);
  throw error;
} finally {
  if (browser) await browser.close();
  await Promise.all(
    processes.map(
      (child) =>
        new Promise((done) => {
          if (child.exitCode !== null) return done();
          child.once("exit", done);
          child.kill();
        }),
    ),
  );
  const root = resolve(tmpdir()),
    target = resolve(temp);
  if (!target.startsWith(root + "\\") && !target.startsWith(root + "/"))
    throw new Error("Refusing cleanup outside temp directory");
  await rm(target, { recursive: true, force: true });
}
