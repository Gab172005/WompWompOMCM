import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("..", import.meta.url));
const backend = fileURLToPath(new URL("../../backend", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "omcm-simulation-"));
const username = "simulation-browser-test";
const password = "isolated-simulation-password-2026";
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
      logs = (logs + chunk).slice(-18000);
    });
  processes.push(child);
  return child;
}

async function ready(url, child) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null)
      throw new Error("A simulation verification server exited early.");
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* Starting up. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("A simulation verification server did not become ready.");
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
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8008"],
    backend,
    {
      OMCM_DATASET: "pilot",
      OMCM_DATABASE_PATH: join(temporary, "simulation.db"),
      OMCM_DEMO_AUTH: "true",
      OMCM_ADMIN_USERNAME: username,
      OMCM_ADMIN_PASSWORD: password,
    },
  );
  await ready("http://127.0.0.1:8008/api/health", api);
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
      OMCM_PROXY_TARGET: "http://127.0.0.1:8008",
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
  let plannerResponse;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/planning/simulation/optimize"))
      plannerResponse = response;
  });
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("http://127.0.0.1:5178", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".barangay-boundary")).toHaveCount(681, {
    timeout: 90000,
  });
  await page
    .getByRole("button", { name: "Admin View", exact: true })
    .first()
    .click();
  await page.getByLabel("Administrator username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Sign in to Admin View", exact: true })
    .click();
  await expect(page.locator(".workspace")).toHaveClass(/is-admin-view/);
  await page
    .getByRole("button", { name: "30-day simulation", exact: true })
    .click();
  const panel = page.getByRole("complementary", {
    name: "Try a 30-day clinic plan",
    exact: true,
  });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole("button", { name: /^No intervention, day 1, HNI/ }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: /^Manual clinic allocation, day 1, HNI/,
    }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: /^Optimized clinic allocation, day 1, HNI/,
    }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "HNI", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await panel.locator(".workspace-panel-body").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: "/tmp/omcm-simulation-desktop.png",
    animations: "disabled",
  });

  const baselineDay1 = await page.evaluate(async () => {
    const { useForecastStore } = await import("/src/store/useForecastStore.ts");
    const state = useForecastStore.getState();
    const record = state.runs.none.snapshots[0].records[0];
    const path = document.querySelector(
      'path[data-barangay-psgc="' + record.psgc + '"]',
    );
    return {
      psgc: record.psgc,
      hni: record.hni,
      color: path?.getAttribute("fill"),
      clinicCount: state.runs.none.snapshots[0].allocation.length,
    };
  });
  expect(baselineDay1.clinicCount).toBe(0);
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  const baselineDay3 = await page.evaluate(async (psgc) => {
    const { useForecastStore } = await import("/src/store/useForecastStore.ts");
    const state = useForecastStore.getState();
    const record = state.runs.none.snapshots[2].records.find(
      (entry) => entry.psgc === psgc,
    );
    return {
      hni: record?.hni,
      color: document
        .querySelector('path[data-barangay-psgc="' + psgc + '"]')
        ?.getAttribute("fill"),
      averageDay1: state.runs.none.snapshots[0].metrics.baselineHni,
      averageDay3: state.runs.none.snapshots[2].metrics.baselineHni,
    };
  }, baselineDay1.psgc);
  expect(baselineDay3.hni).toBeGreaterThan(baselineDay1.hni);
  expect(baselineDay3.averageDay3).toBeGreaterThan(baselineDay3.averageDay1);
  expect(baselineDay3.color).not.toBe(baselineDay1.color);
  const sharedDay = await page.evaluate(async () => {
    const { useForecastStore } = await import("/src/store/useForecastStore.ts");
    return Object.values(useForecastStore.getState().runs).map(
      (run) => run.day,
    );
  });
  expect(sharedDay).toEqual([3, 3, 3]);

  await panel
    .getByRole("button", { name: /^Manual clinic allocation, day 3, HNI/ })
    .click();
  await panel.getByLabel("Available mobile clinics").fill("1");
  const manualSites = await page.evaluate(async () => {
    const { useForecastStore } = await import("/src/store/useForecastStore.ts");
    const state = useForecastStore.getState();
    const host = [...state.coverage.keys()].find((psgc) => {
      const reach = state.coverage.get(psgc);
      return reach?.size && [...reach.keys()].some((target) => target !== psgc);
    });
    if (!host) throw new Error("No simulation site has a neighboring area.");
    const neighbors = [...state.coverage.get(host).keys()].filter(
      (psgc) => psgc !== host,
    );
    const outside = state.forecasts[0].find(
      (record) => !state.coverage.get(host).has(record.psgc),
    );
    if (!neighbors.length || !outside)
      throw new Error(
        "The selected site needs a neighbor and an unaffected area.",
      );
    return { host, neighbor: neighbors[0], outside: outside.psgc };
  });
  await panel
    .getByLabel("MC-1 barangay", { exact: true })
    .selectOption(manualSites.host);
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(1);
  const manualResponse = page.waitForResponse(
    (response) => response.url().includes("/api/planning/simulation/evaluate"),
    { timeout: 90000 },
  );
  await panel
    .getByRole("button", { name: "Apply my clinic locations", exact: true })
    .click();
  expect((await manualResponse).status()).toBe(200);
  await expect(
    panel.getByRole("button", {
      name: "Apply my clinic locations",
      exact: true,
    }),
  ).toBeDisabled();
  const manualImpact = await page.evaluate(async (sites) => {
    const { useForecastStore } = await import("/src/store/useForecastStore.ts");
    const { getSimulationNeedColor } =
      await import("/src/services/lagunaData.ts");
    const state = useForecastStore.getState();
    const records = new Map(
      state.runs.manual.snapshots[0].records.map((record) => [
        record.psgc,
        record,
      ]),
    );
    const host = records.get(sites.host);
    const hostColor = document
      .querySelector('path[data-barangay-psgc="' + sites.host + '"]')
      ?.getAttribute("fill");
    return {
      hostLower: host.scenarioHni < host.hni,
      hostColorChanged:
        hostColor !== getSimulationNeedColor(host.hni) &&
        hostColor === getSimulationNeedColor(host.scenarioHni),
      neighborLower:
        records.get(sites.neighbor).scenarioHni <
        records.get(sites.neighbor).hni,
      outsideUnchanged:
        records.get(sites.outside).scenarioHni ===
        records.get(sites.outside).hni,
      deployed: state.runs.manual.snapshots[0].allocation.length,
    };
  }, manualSites);
  expect(manualImpact.hostLower).toBe(true);
  expect(manualImpact.hostColorChanged).toBe(true);
  expect(manualImpact.neighborLower).toBe(true);
  expect(manualImpact.outsideUnchanged).toBe(true);
  expect(manualImpact.deployed).toBe(1);
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(1);
  await expect(
    panel.getByText("Scenario activity", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("1 clinic placed", { exact: true }),
  ).toBeVisible();
  const manualReach = await page.evaluate(
    (sites) => ({
      host: document
        .querySelector('path[data-barangay-psgc="' + sites.host + '"]')
        ?.classList.contains("has-clinic-impact"),
      neighbor: document
        .querySelector('path[data-barangay-psgc="' + sites.neighbor + '"]')
        ?.classList.contains("has-clinic-impact"),
      outside: document
        .querySelector('path[data-barangay-psgc="' + sites.outside + '"]')
        ?.classList.contains("has-clinic-impact"),
    }),
    manualSites,
  );
  expect(manualReach).toEqual({ host: true, neighbor: true, outside: false });

  await panel.getByLabel("Available mobile clinics").fill("3");
  const comparisonSites = await page.evaluate(async () => {
    const { useForecastStore } = await import("/src/store/useForecastStore.ts");
    return [...useForecastStore.getState().coverage.keys()].slice(0, 3);
  });
  for (let index = 0; index < 3; index++)
    await panel
      .getByLabel(`MC-${index + 1} barangay`, { exact: true })
      .selectOption(comparisonSites[index]);
  const comparisonEvaluation = page.waitForResponse(
    (response) => response.url().includes("/api/planning/simulation/evaluate"),
    { timeout: 90000 },
  );
  await panel
    .getByRole("button", { name: "Apply my clinic locations", exact: true })
    .click();
  expect((await comparisonEvaluation).status()).toBe(200);
  await expect(
    panel.getByRole("button", {
      name: "Apply my clinic locations",
      exact: true,
    }),
  ).toBeDisabled();
  await panel
    .getByRole("button", { name: /^Optimized clinic allocation, day 1, HNI/ })
    .click();
  const generatedPlan = page.waitForResponse(
    (response) => response.url().includes("/api/planning/simulation/optimize"),
    { timeout: 90000 },
  );
  await panel
    .getByRole("button", { name: "Generate optimized locations", exact: true })
    .click();
  const response = await generatedPlan;
  expect(plannerResponse, logs).toBeTruthy();
  expect(response.status()).toBe(200);
  const plan = await response.json();
  expect(response.request().postDataJSON()).toMatchObject({ clinic_count: 3 });
  expect(plan.evaluation.notes.join(" ")).toContain("XGBoost");
  expect(plan.evaluation.notes.join(" ")).toContain("Agreed Balanced HNI");
  expect(plan.locations).toHaveLength(3);
  expect(response.request().postDataJSON().comparison_sites).toEqual(
    comparisonSites,
  );
  expect(plan.evaluation.days[0].metrics.hni).toBeLessThanOrEqual(
    plan.comparison_hni + 1e-9,
  );
  await expect(
    panel.getByText("Simulation proposal " + plan.proposal_id),
    await panel.innerText(),
  ).toBeVisible();
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(3);
  const unconfirmed = await page.evaluate(async () => {
    const { useForecastStore } = await import("/src/store/useForecastStore.ts");
    return useForecastStore.getState().runs.optimizer.snapshots[0].allocation
      .length;
  });
  expect(unconfirmed).toBe(0);
  await panel
    .getByRole("button", { name: "Apply these clinic locations", exact: true })
    .click();
  const optimizedImpact = await page.evaluate(async () => {
    const { useForecastStore } = await import("/src/store/useForecastStore.ts");
    const state = useForecastStore.getState();
    const snapshot = state.runs.optimizer.snapshots[0];
    const records = new Map(
      snapshot.records.map((record) => [record.psgc, record]),
    );
    const hosts = snapshot.allocation.map((entry) => records.get(entry.psgc));
    return {
      deployed: snapshot.allocation.length,
      allHostsLower: hosts.every((record) => record.scenarioHni < record.hni),
      hni: snapshot.metrics.hni,
      manualHni: state.runs.manual.snapshots[0].metrics.hni,
      mapHni:
        snapshot.records.reduce(
          (sum, record) => sum + record.scenarioHni * record.population,
          0,
        ) /
        snapshot.records.reduce((sum, record) => sum + record.population, 0),
      affectedAreas: snapshot.records.filter(
        (record) => record.serviceFraction > 0,
      ).length,
    };
  });
  expect(optimizedImpact.deployed).toBe(3);
  expect(optimizedImpact.hni).toBeLessThanOrEqual(
    optimizedImpact.manualHni + 1e-9,
  );
  expect(optimizedImpact.mapHni).toBeCloseTo(optimizedImpact.hni, 9);
  await expect(
    panel.getByLabel("MC-1 barangay", { exact: true }),
  ).toBeDisabled();
  console.log(
    "Connected comparison:",
    JSON.stringify({
      manualHni: optimizedImpact.manualHni,
      optimizedHni: optimizedImpact.hni,
      affectedAreas: optimizedImpact.affectedAreas,
    }),
  );
  expect(optimizedImpact.allHostsLower).toBe(true);
  expect(optimizedImpact.affectedAreas).toBeGreaterThan(3);
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(3);
  await panel.locator(".workspace-panel-body").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: "/tmp/omcm-simulation-hni-comparison.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  const synchronizedDay = await page.evaluate(async () => {
    const { useForecastStore } = await import("/src/store/useForecastStore.ts");
    return Object.values(useForecastStore.getState().runs).map(
      (run) => run.day,
    );
  });
  expect(synchronizedDay).toEqual([2, 2, 2]);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const panelBox = await panel.boundingBox();
  const playbackBox = await page
    .getByRole("region", { name: "Simulation playback" })
    .boundingBox();
  const legendBox = await page
    .getByRole("region", { name: "Map legend" })
    .boundingBox();
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(playbackBox.y);
  expect(playbackBox.y + playbackBox.height).toBeLessThanOrEqual(legendBox.y);
  await page.screenshot({
    path: "/tmp/omcm-simulation-mobile.png",
    animations: "disabled",
  });
  await panel.getByRole("button", { name: "Collapse tool panel" }).click();
  await expect(panel.locator(".workspace-panel-body")).toBeHidden();
  await expect(page.locator(".clinic-staging-marker")).toHaveCount(3);
  await expect(
    page.getByRole("region", { name: "Simulation playback" }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Expand tool panel" }).click();
  await expect(panel.locator(".workspace-panel-body")).toBeVisible();
  expect(errors, logs).toEqual([]);
  console.log(
    "Simulation browser checks passed: rising baseline, authenticated manual evaluation, host/neighbor map impact, shared population-weighted HNI, real XGBoost/CP-SAT optimization no worse than manual, clinic markers, and mobile layout.",
  );
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page)
    await page.screenshot({ path: "/tmp/omcm-simulation-browser-failure.png" });
  throw new Error(error + "\n" + logs);
} finally {
  await browser?.close();
  await Promise.all(processes.map(stop));
  await rm(temporary, { recursive: true, force: true });
}
