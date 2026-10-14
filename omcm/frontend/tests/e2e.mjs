import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

// This exercises actual frontend -> Vite proxy -> FastAPI -> OR-Tools -> SQLite.
// Both server processes and the isolated temporary database belong to this test.
const temp = await mkdtemp(join(tmpdir(), "omcm-e2e-"));
const password = randomBytes(24).toString("base64url");
const username = "browser-test-admin";
const backend = resolve("../backend");
const python =
  process.platform === "win32"
    ? join(backend, ".venv/Scripts/python.exe")
    : join(backend, ".venv/bin/python");
const processes = [];
let browser;
let page;
const errors = [];
function start(command, args, cwd, env = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (data) => {
    log += data;
  });
  child.stderr.on("data", (data) => {
    log += data;
  });
  child.on("error", (error) => {
    log += error.message;
  });
  processes.push(child);
  return { child, log: () => log };
}
async function ready(url, server) {
  for (let i = 0; i < 60; i++) {
    if (server.child.exitCode !== null)
      throw new Error(`Test server failed: ${server.log()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Test server timed out: ${server.log()}`);
}
async function insideArea(selector) {
  return page.locator(selector).evaluate((path) => {
    const bounds = path.getBBox();
    for (const x of [.5, .35, .65, .2, .8]) {
      for (const y of [.5, .35, .65, .2, .8]) {
        const local = new DOMPoint(bounds.x + bounds.width * x, bounds.y + bounds.height * y);
        if (path.isPointInFill(local)) {
          const screen = local.matrixTransform(path.getScreenCTM());
          return { x: screen.x, y: screen.y };
        }
      }
    }
    throw new Error("Could not find interior of real Laguna area");
  });
}
try {
  const apiServer = start(
    python,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
    backend,
    {
      OMCM_DATABASE_PATH: join(temp, "browser.db"),
      OMCM_DEMO_AUTH: "true",
      OMCM_ADMIN_USERNAME: username,
      OMCM_ADMIN_PASSWORD: password,
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
    { OMCM_PROXY_TARGET: "http://127.0.0.1:8001", VITE_API_URL: "" },
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
  page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5174");
  await page
    .getByRole("heading", { name: "Better care. Within reach." })
    .waitFor();
  await page.locator("path.barangay-marker").nth(680).waitFor();
  assert.equal(
    (await page.locator("path.barangay-marker").count()) === 681,
    true,
  );
  await mkdir("test-results", { recursive: true });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  assert.equal(await page.locator('path.barangay-marker[fill="#D1D5DB"]').count(), 681);
  const delCarmen = await insideArea("path.area-403401001");
  await page.mouse.move(delCarmen.x, delCarmen.y);
  await page.locator(".risk-hover").waitFor();
  assert.match(await page.locator(".risk-hover").innerText(), /Del Carmen, Alaminos.*Healthcare need: No data/s);
  await page.mouse.click(delCarmen.x, delCarmen.y);
  await page.locator(".map-detail").waitFor();
  assert.match(
    await page.locator(".map-detail").innerText(),
    /LAGUNA BARANGAY.*403401001.*Del Carmen.*No data/s,
  );
  await page.getByRole("button", { name: "Close barangay details" }).click();
  await page
    .getByRole("link", { name: "Clinic Optimization", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate Optimal Placement" })
    .click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Recommended staging locations" })
    .waitFor();
  assert.equal(await page.locator(".clinic-card").count(), 3);
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: "test-results/optimization-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Clinic Schedules", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve deployment", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Deployment approved" })
    .waitFor();
  const tomorrow = await page
    .getByLabel("Deployment date", { exact: true })
    .inputValue();
  const schedulesBefore = await (
    await fetch("http://127.0.0.1:8001/api/schedules")
  ).json();
  assert.equal(schedulesBefore.schedules.length, 1);
  await page
    .getByRole("link", { name: "Disaster Simulator", exact: true })
    .click();
  await page.getByLabel("Lakeside community hub", { exact: true }).check();
  await page
    .getByRole("button", { name: "Run simulation", exact: true })
    .click();
  await page.getByText("Previously allocated", { exact: true }).waitFor();
  await page.waitForTimeout(1500);
  const schedulesAfter = await (
    await fetch("http://127.0.0.1:8001/api/schedules")
  ).json();
  assert.deepEqual(schedulesAfter, schedulesBefore);
  await page.getByRole("button", { name: /Clinic shortage/ }).click();
  await page.getByLabel("Clinics available", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Run simulation", exact: true })
    .click();
  await page.getByText("Previously allocated", { exact: true }).waitFor();
  await page.screenshot({
    path: "test-results/simulation-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const scoreResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/risk/calculate") &&
      response.request().method() === "POST",
  );
  await page.getByRole("slider", { name: /Disease burden/ }).focus();
  await page
    .getByRole("slider", { name: /Disease burden/ })
    .press("ArrowRight");
  const scores = await (await scoreResponse).json();
  assert.equal(scores.weights.disease, 31);
  await page
    .getByRole("link", { name: "Data and Analytics", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Evidence behind every placement" })
    .waitFor();
  await page
    .getByRole("link", { name: "Healthcare Risk Map", exact: true })
    .click();
  await page.getByLabel("Map layer", { exact: true }).selectOption("flood");
  const expectedFill = (value) => value >= 70 ? "#7F1D1D" : value >= 50 ? "#DC2626"
    : value >= 30 ? "#F87171" : value >= 15 ? "#FCBABA" : "#FEE5E5";
  const polygonFills = () => page.locator("path.barangay-marker").evaluateAll(
    (paths) => paths.map((path) => path.getAttribute("fill")),
  );
  assert.deepEqual(await polygonFills(), Array(681).fill("#D1D5DB"));
  await page.getByLabel("Map layer", { exact: true }).selectOption("score");
  assert.deepEqual(await polygonFills(), Array(681).fill("#D1D5DB"));
  assert.equal(await page.locator("tbody tr").count(), 20);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .getByRole("heading", { name: "Better care. Within reach." })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: "test-results/overview-mobile.png",
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:5174/public");
  await page.getByRole("heading", { name: /Your next care visit/ }).waitFor();
  await page.getByLabel("Schedule date").fill(tomorrow);
  await page.locator(".public-clinic").first().waitFor();
  assert.equal(await page.locator(".public-clinic").count(), 3);
  assert.equal(
    await page
      .getByRole("button", { name: "Generate Optimal Placement" })
      .count(),
    0,
  );
  assert.equal(await page.locator(".sidebar").count(), 0);
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: "test-results/public-mobile.png",
    fullPage: true,
  });
  // Test-only alias; shipped mapping remains empty. Values come from the API.
  await page.route("**/data/geo/laguna_record_mapping.json", (route) => route.fulfill({
    json: { "403401001": "B01" },
  }));
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("http://127.0.0.1:5174");
  const initial = await (await fetch("http://127.0.0.1:8001/api/barangays")).json();
  await page.locator("path.barangay-marker").nth(680).waitFor();
  const firstRegion = page.locator("path.area-403401001");
  assert.equal(await firstRegion.getAttribute("fill"), expectedFill(initial.barangays.find((b) => b.id === "B01").score));
  const mappedPoint = await insideArea("path.area-403401001");
  await page.mouse.click(mappedPoint.x, mappedPoint.y);
  assert.match(await page.locator(".map-detail").innerText(), /Del Carmen.*Healthcare record: Demo Lakeside/s);
  assert.match(await page.locator(".map-detail").innerText(), /3,400/);
  await page.getByRole("button", { name: "Close barangay details" }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /Sign in/ }).first().click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const recalculated = page.waitForResponse((response) => response.url().endsWith("/api/risk/calculate") && response.request().method() === "POST"
    && JSON.parse(response.request().postData()).disease === 31);
  await page.waitForFunction(() => !document.querySelector("#weight-disease").disabled);
  await page.getByRole("slider", { name: /Disease burden/ }).focus();
  await page.getByRole("slider", { name: /Disease burden/ }).press("ArrowRight");
  const live = await (await recalculated).json();
  await page.getByRole("link", { name: "Healthcare Risk Map", exact: true }).click();
  await page.locator("path.barangay-marker").nth(680).waitFor();
  const b01 = live.barangays.find((b) => b.id === "B01");
  assert.equal(await page.locator("path.area-403401001").getAttribute("fill"), expectedFill(b01.score));
  await page.getByLabel("Map layer", { exact: true }).selectOption("flood");
  assert.equal(await page.locator("path.area-403401001").getAttribute("fill"), expectedFill(b01.factors.flood));
  assert.equal(await page.locator('path.barangay-marker[fill="#D1D5DB"]').count(), 680);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: map detail, server authentication, optimization, approval/public schedule, flood/shortage simulation, schedule isolation, weight recalculation, navigation, responsive layout, and no browser runtime errors.",
  );
} catch (error) {
  if (page) {
    await mkdir("test-results", { recursive: true });
    await page.screenshot({ path: "test-results/failure.png", fullPage: true });
  }
  console.error("Browser runtime errors:", errors);
  throw error;
} finally {
  if (browser) await browser.close();
  await Promise.all(
    processes.map(
      (child) =>
        new Promise((resolve) => {
          if (child.exitCode !== null) {
            resolve();
            return;
          }
          child.once("exit", resolve);
          child.kill();
        }),
    ),
  );
  await rm(temp, { recursive: true, force: true });
}
