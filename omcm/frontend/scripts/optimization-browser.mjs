import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("..", import.meta.url));
const backend = fileURLToPath(new URL("../../backend", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "omcm-optimizer-"));
const username = "optimizer-browser-test";
const password = "isolated-browser-password-2026";
const processes = [];
let browser;
let logs = "";
function start(command, args, cwd, env) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (chunk) => {
      logs = (logs + chunk).slice(-16000);
    });
  processes.push(child);
  return child;
}
async function ready(url, child) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null)
      throw new Error("Verification server exited early.");
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* Starting up. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Verification server did not become ready.");
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await exited;
}

try {
  const python =
    process.env.OMCM_PYTHON ||
    join(
      backend,
      process.platform === "win32"
        ? ".venv/Scripts/python.exe"
        : ".venv/bin/python",
    );
  const startApi = () => start(
    python,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8007"],
    backend,
    {
      OMCM_DATASET: "pilot",
      OMCM_DATABASE_PATH: join(temporary, "browser.db"),
      OMCM_DEMO_AUTH: "true",
      OMCM_ADMIN_USERNAME: username,
      OMCM_ADMIN_PASSWORD: password,
    },
  );
  let api = startApi();
  await ready("http://127.0.0.1:8007/api/health", api);
  const vite = start(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5179",
      "--strictPort",
    ],
    frontend,
    {
      VITE_DEMO_MODE: "false",
      VITE_API_URL: "",
      VITE_GOOGLE_MAPS_API_KEY: "",
      OMCM_PROXY_TARGET: "http://127.0.0.1:8007",
    },
  );
  await ready("http://127.0.0.1:5179", vite);
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
  await page.goto("http://127.0.0.1:5179", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".barangay-boundary")).toHaveCount(681);
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Admin View", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Use demo sign-in details" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Connected administrator sign-in", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Administrator username").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("laguna-lgu-2026");
  const rejected = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/me"),
  );
  await page.getByRole("button", { name: "Sign in to Admin View" }).click();
  expect((await rejected).status()).toBe(401);
  await expect(page.getByRole("alert")).toContainText(
    "username or password is incorrect",
  );
  await page.getByLabel("Administrator username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to Admin View" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/is-admin-view/);
  await expect(page).toHaveURL(/\/admin$/);
  await page
    .getByRole("button", { name: "30-day simulation", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Try a 30-day clinic plan" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Plan clinics", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const panel = page.getByRole("complementary", {
    name: "Plan clinic locations",
  });
  await expect(
    panel.getByText("All Laguna · 681 barangays · 30 LGUs"),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Generate recommendations" }),
  ).toBeEnabled();
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(0);
  await page.getByLabel("Available mobile clinics").focus();
  await page.getByLabel("Available mobile clinics").press("ArrowLeft");
  await expect(page.getByLabel("Available mobile clinics")).toHaveValue("2");
  await page.getByLabel("Daily capacity per clinic").fill("70");
  await page.getByLabel("Maximum modeled travel minutes").fill("20");
  const generated = page.waitForResponse(
    (response) => response.url().endsWith("/api/planning/optimize"),
    { timeout: 90000 },
  );
  await panel.getByRole("button", { name: "Generate recommendations" }).click();
  const response = await generated;
  expect(response.status()).toBe(200);
  let plan = await response.json();
  expect(response.request().postDataJSON()).toMatchObject({
    clinic_count: 2,
    capacity: 70,
    max_travel_minutes: 20,
  });
  expect(plan.notes.join(" ")).toContain("XGBoost");
  expect(plan.notes.join(" ")).toContain("Dated synthetic history");
  expect(
    plan.notes.some((note) =>
      /^Forecast target date: \d{4}-\d{2}-\d{2}$/.test(note),
    ),
  ).toBe(true);
  expect(plan.barangays).toHaveLength(681);
  expect(new Set(plan.barangays.map((b) => b.municipality)).size).toBe(30);
  expect(plan.notes.join(" ")).toContain("Agreed Balanced HNI");
  expect(plan.optimized.clinics).toHaveLength(2);
  await expect(
    page.locator(".barangay-boundary.has-clinic-impact").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Planned clinic impact", { exact: true }),
  ).toBeVisible();
  expect(plan.flood_affected_barangays).toEqual([]);
  await expect(
    panel.getByRole("region", { name: "Backend allocation results" }),
  ).toContainText(plan.plan_id);
  // A reload destroys credentials and transient Zustand drafts. Recover only
  // after signing in, from the real authenticated saved-plan endpoint.
  await stop(api);
  api = startApi();
  await ready("http://127.0.0.1:8007/api/health", api);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByLabel("Administrator username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to Admin View" }).click();
  await page.getByRole("button", { name: "Plan clinics", exact: true }).click();
  const savedWork = page.getByRole("region", { name: "Your saved work" });
  await savedWork.getByRole("button", { name: /^Plans / }).click();
  await savedWork.getByRole("button", { name: new RegExp(`${plan.plan_id}$`) }).click();
  await expect(panel.getByRole("region", { name: "Backend allocation results" })).toContainText(plan.plan_id);
  await expect(page.getByLabel("Daily capacity per clinic")).toHaveValue("70");
  await expect(page.getByLabel("Maximum modeled travel minutes")).toHaveValue("20");
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(2);
  await expect(panel).toContainText(
    "Municipality’s estimated healthcare need (map)",
  );
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(
    plan.optimized.clinics.length,
  );
  for (const clinic of plan.optimized.clinics) {
    await expect(
      page
        .locator(".clinic-staging-marker")
        .filter({ has: page.locator("svg") }),
    ).toHaveCount(2);
    await expect(
      panel.getByRole("heading", { name: new RegExp(clinic.name) }),
    ).toBeVisible();
  }
  const draftSchedules = await (
    await fetch("http://127.0.0.1:8007/api/schedules")
  ).json();
  expect(draftSchedules.schedules).toEqual([]);
  const catalog = await (
    await fetch("http://127.0.0.1:8007/api/planning/clinics", {
      headers: {
        Authorization:
          "Basic " + Buffer.from(username + ":" + password).toString("base64"),
      },
    })
  ).json();
  expect(catalog.sites).toHaveLength(681);
  const unused = catalog.sites.find(
    (site) =>
      site.eligible &&
      site.name.includes("Calamba") &&
      !plan.optimized.clinics.some((clinic) => clinic.id === site.id),
  );
  expect(
    unused,
    "A Calamba planning point must be available beyond the old pilot",
  ).toBeTruthy();
  const previousSites = plan.optimized.clinics.map((clinic) => clinic.id);
  const replan = page.waitForResponse(
    (next) => next.url().endsWith("/api/planning/optimize"),
    { timeout: 90000 },
  );
  // Preserve the original UI failure if an assertion closes the browser before
  // the pending network observer settles.
  void replan.catch(() => {});
  await page
    .getByLabel("Replan site " + previousSites[0], { exact: true })
    .fill(unused.id);
  const choice = page.locator(".workspace-picker").getByRole("option");
  await expect(choice).toHaveCount(1);
  await expect(choice).not.toHaveAttribute("aria-disabled", "true");
  await choice.click();
  const manualResponse = await replan;
  expect(manualResponse.status()).toBe(200);
  plan = await manualResponse.json();
  expect(new Set(plan.inputs.manual_sites)).toEqual(
    new Set([unused.id, previousSites[1]]),
  );
  expect(new Set(plan.optimized.clinics.map((clinic) => clinic.id))).toEqual(
    new Set(plan.inputs.manual_sites),
  );
  await expect(
    panel.getByRole("region", { name: "Backend allocation results" }),
  ).toContainText(plan.plan_id);
  await mkdir(join(frontend, "test-results"), { recursive: true });
  await page.screenshot({
    path: join(frontend, "test-results/optimization-connected-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    panel.getByRole("button", { name: "Generate recommendations" }),
  ).toBeVisible();
  await page.screenshot({
    path: join(frontend, "test-results/optimization-connected-mobile.png"),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await panel
    .getByRole("checkbox", { name: /Emergency schedule override/ })
    .check();
  await panel.getByLabel("Public emergency notice").fill("hello");
  await expect(
    panel.getByRole("button", {
      name: "Confirm emergency override",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(panel.getByText(/5\/10 characters minimum/)).toBeVisible();
  await panel
    .getByLabel("Public emergency notice")
    .fill("Clinic relocated to the barangay hall.");
  await panel
    .getByRole("checkbox", {
      name: "I confirm this emergency revision and public notice.",
    })
    .check();
  await expect(
    panel.getByRole("button", {
      name: "Confirm emergency override",
      exact: true,
    }),
  ).toBeEnabled();
  await panel
    .getByRole("checkbox", { name: /Emergency schedule override/ })
    .uncheck();
  const latestBooking = await panel
    .getByLabel("Deployment date")
    .getAttribute("max");
  await panel.getByLabel("Deployment date").fill(latestBooking);
  const published = page.waitForResponse((next) =>
    next.url().endsWith("/api/schedules/approve"),
  );
  await panel
    .getByRole("button", { name: "Approve & publish schedule", exact: true })
    .click();
  const approved = await published;
  expect(approved.status()).toBe(200);
  const schedule = await approved.json();
  expect(schedule.plan_id).toBe(plan.plan_id);
  expect(schedule.date).toBe(latestBooking);
  await expect(
    panel
      .getByRole("status")
      .filter({ hasText: "Published approved schedule" }),
  ).toContainText("Published approved schedule");
  await stop(api);
  api = startApi();
  await ready("http://127.0.0.1:8007/api/health", api);
  await savedWork.getByRole("button", { name: /^Deployments / }).click();
  await savedWork.getByRole("button").filter({ hasText: "08:00–17:00 PH" }).first().click();
  await expect(panel.getByRole("region", { name: "Selected deployment" })).toContainText("published clinic locations");
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(2);
  await page.locator(".clinic-staging-marker").first().click();
  await expect(page.locator(".leaflet-popup-content")).toContainText(schedule.date);
  await page.keyboard.press("Escape");
  await savedWork.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(frontend, "test-results/saved-work-desktop.png") });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await savedWork.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(frontend, "test-results/saved-work-mobile.png") });
  await panel.getByRole("region", { name: "Selected deployment" }).screenshot({ path: join(frontend, "test-results/saved-deployment-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await panel.getByRole("button", { name: "Review original plan" }).click();
  await expect(panel.getByRole("region", { name: "Backend allocation results" })).toContainText(plan.plan_id);
  await panel.getByRole("button", { name: "Preview Public View" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/is-public-view/);
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(2);
  await expect(
    page.getByRole("region", { name: "Backend allocation results" }),
  ).toHaveCount(0);
  const fresh = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await fresh.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await fresh.goto("http://127.0.0.1:5179");
  await fresh
    .getByRole("button", { name: /Schedules & Advisories|Approved Schedule/ })
    .click();
  await expect(fresh.getByLabel("Schedule date")).toHaveCount(0);
  await fresh.getByRole("button", { name: /Next clinic day/ }).click();
  await expect(fresh.locator(".clinic-staging-marker")).toHaveCount(2);
  await expect(
    fresh.getByRole("meter", { name: "Healthcare need out of 100" }),
  ).toHaveCount(0);
  await fresh.locator(".care-visit-information summary").first().click();
  await expect(fresh.getByText(/Planned service area:/).first()).toBeVisible();
  await expect(fresh.locator("body")).not.toContainText(
    "Forecast target date:",
  );
  await fresh.screenshot({
    path: join(frontend, "test-results/public-visits-desktop.png"),
  });
  await fresh.setViewportSize({ width: 390, height: 844 });
  await expect(
    fresh.getByRole("region", { name: "Published clinic visits" }),
  ).toBeVisible();
  expect(
    await fresh.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await fresh.screenshot({
    path: join(frontend, "test-results/public-visits-mobile.png"),
  });
  await fresh.setViewportSize({ width: 1440, height: 1000 });
  const headers = {
    "Content-Type": "application/json",
    Authorization:
      "Basic " + Buffer.from(username + ":" + password).toString("base64"),
  };
  const revisedResponse = await fetch(
    "http://127.0.0.1:8007/api/planning/optimize",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ clinic_count: 1, capacity: 70 }),
    },
  );
  expect(revisedResponse.status).toBe(200);
  const revised = await revisedResponse.json();
  const publicRefresh = fresh.waitForResponse((response) =>
    response.url().endsWith("/api/schedules"),
  );
  await fresh.bringToFront();
  await fresh.evaluate(() => window.dispatchEvent(new Event("focus")));
  await publicRefresh;
  await expect(fresh.getByText("2 clinics announced")).toBeVisible();
  await expect(fresh.locator(".clinic-staging-marker")).toHaveCount(2);
  const notice = "Test emergency update: revised approved clinic arrangements.";
  const emergencyResponse = await fetch(
    "http://127.0.0.1:8007/api/schedules/emergency-override",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        plan_id: revised.plan_id,
        deployment_date: schedule.date,
        notice,
        confirmed: true,
      }),
    },
  );
  expect(emergencyResponse.status).toBe(200);
  await fresh.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(fresh.locator(".clinic-staging-marker")).toHaveCount(1);
  await expect(
    fresh.getByRole("alert").filter({ hasText: notice }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Admin View", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Plan clinics", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Generate recommendations" }),
  ).toBeEnabled();
  await panel
    .getByLabel("Optimization flood scenario")
    .selectOption("moderate");
  const floodGenerated = page.waitForResponse((response) =>
    response.url().endsWith("/api/planning/optimize"),
  );
  void floodGenerated.catch(() => {});
  await panel.getByRole("button", { name: "Generate recommendations" }).click();
  const floodResponse = await floodGenerated;
  expect(floodResponse.status()).toBe(200);
  plan = await floodResponse.json();
  expect(floodResponse.request().postDataJSON()).toMatchObject({
    flood_level: "moderate",
  });
  expect(plan.flood_affected_barangays.length).toBeGreaterThan(0);
  await expect(page.locator(".barangay-boundary.has-flood-impact")).toHaveCount(
    plan.flood_affected_barangays.length,
  );
  await expect(
    page.getByText(
      new RegExp(
        `25-year flood layer · ${plan.flood_affected_barangays.length} barangays outlined`,
      ),
    ),
  ).toBeVisible();
  await page.screenshot({
    path: join(frontend, "test-results/optimization-flood-impact.png"),
  });
  await stop(api);
  await fresh.bringToFront();
  await fresh.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    fresh.getByRole("alert").filter({ hasText: "last confirmed" }),
  ).toBeVisible();
  await expect(fresh.locator(".clinic-staging-marker")).toHaveCount(1);
  await fresh.close();
  await panel.getByRole("button", { name: "Generate recommendations" }).click();
  await expect(
    panel
      .getByRole("alert")
      .filter({ hasText: /could not (connect|read|calculate)|unavailable/i })
      .first(),
  ).toBeVisible();
  await expect(
    panel.getByRole("region", { name: "Backend allocation results" }),
  ).toHaveCount(0);
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    "Connected optimizer browser checks passed: real FastAPI/XGBoost/CP-SAT requests, flood-affected barangay map overlay, manual replan, saved-plan recovery after backend restart/reload, published-deployment review, saved draft approval, fresh public schedule, mobile layout, no hardcoded fallback when backend stops.",
  );
} catch (error) {
  const failedPage = browser?.contexts()[0]?.pages()[0];
  if (failedPage)
    await failedPage.screenshot({
      path: "/tmp/omcm-optimizer-ui-failure.png",
      animations: "disabled",
    });
  console.error(logs);
  throw error;
} finally {
  await browser?.close();
  for (const child of processes.reverse()) await stop(child);
  await rm(temporary, { recursive: true, force: true });
}
