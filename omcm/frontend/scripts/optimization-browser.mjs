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
  const api = start(
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
  await ready("http://127.0.0.1:8007/api/health", api);
  const vite = start(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5178",
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
  await ready("http://127.0.0.1:5178", vite);
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
  await page.goto("http://127.0.0.1:5178", { waitUntil: "domcontentloaded" });
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
  await page.getByRole("button", { name: "Plan clinics", exact: true }).click();
  const panel = page.getByRole("complementary", {
    name: "Plan clinic locations",
  });
  await expect(
    panel.getByText("Los Baños–Bay · 20-barangay pilot"),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Generate recommendations" }),
  ).toBeEnabled();
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(0);
  await page.getByLabel("Available mobile clinics").focus();
  await page.getByLabel("Available mobile clinics").press("ArrowLeft");
  await expect(page.getByLabel("Available mobile clinics")).toHaveValue("2");
  await page.getByLabel("Daily capacity per clinic").fill("70");
  await page.getByLabel("Maximum road minutes").fill("20");
  const generated = page.waitForResponse((response) =>
    response.url().endsWith("/api/optimize"),
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
  expect(plan.optimized.clinics).toHaveLength(2);
  await expect(
    panel.getByRole("region", { name: "Backend allocation results" }),
  ).toContainText(plan.plan_id);
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
    await fetch("http://127.0.0.1:8007/api/clinics")
  ).json();
  const unused = catalog.sites.find(
    (site) =>
      site.eligible &&
      !plan.optimized.clinics.some((clinic) => clinic.id === site.id),
  );
  const previousSites = plan.optimized.clinics.map((clinic) => clinic.id);
  const replan = page.waitForResponse((next) =>
    next.url().endsWith("/api/optimize"),
  );
  await page
    .getByLabel("Replan site " + previousSites[0])
    .selectOption(unused.id);
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
  await expect(
    panel
      .getByRole("status")
      .filter({ hasText: "Published approved schedule" }),
  ).toContainText("Published approved schedule");
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
  await fresh.goto("http://127.0.0.1:5178");
  await fresh
    .getByRole("button", { name: /Schedules & Advisories|Approved Schedule/ })
    .click();
  await fresh.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await expect(fresh.locator(".clinic-staging-marker")).toHaveCount(2);
  await expect(
    fresh.getByRole("meter", { name: "Healthcare need out of 100" }),
  ).toHaveCount(0);
  await fresh.close();
  await page
    .getByRole("button", { name: "Admin View", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Plan clinics", exact: true }).click();
  await stop(api);
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
    "Connected optimizer browser checks passed: real FastAPI/XGBoost/CP-SAT requests, manual replan, saved draft approval, fresh public schedule, mobile layout, no hardcoded fallback when backend stops.",
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await browser?.close();
  for (const child of processes.reverse()) await stop(child);
  await rm(temporary, { recursive: true, force: true });
}
