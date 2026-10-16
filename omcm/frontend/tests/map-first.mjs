import { chromium, expect } from "@playwright/test";
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
  const base = "http://127.0.0.1:5174";
  await page.goto(base);
  await expect(page.locator("path.municipality-marker")).toHaveCount(30);
  await expect(
    page.locator(".leaflet-laguna-mask-pane path").first(),
  ).toBeVisible();
  const search = page.getByLabel("Municipality search", { exact: true });
  const los = page.locator("path.area-403411000");
  const initialWidth = await los.evaluate(
    (p) => p.getBoundingClientRect().width,
  );
  async function selectTown(name) {
    await search.fill(name);
    await page
      .getByRole("group", { name: "Municipality search results" })
      .getByRole("button", { name, exact: true })
      .click();
  }
  await selectTown("Los Baños");
  await expect(page.locator(".map-detail")).toContainText(
    "Top contributing factors",
  );
  await expect(page.locator(".map-detail")).toContainText("Barangay list");
  await expect(page.locator(".map-detail")).toContainText(
    "Municipality need rank",
  );
  await expect
    .poll(() => los.evaluate((p) => p.getBoundingClientRect().width))
    .toBeGreaterThan(initialWidth);
  await expect(
    page.locator(".leaflet-municipality-selection-pane path"),
  ).toHaveAttribute("stroke-width", "4");
  await screenshot("map-first-selection-desktop");
  await page
    .getByRole("button", { name: "Close municipality details" })
    .click();
  const municipalityClick = await los.evaluate((path) => {
    const b = path.getBBox();
    for (const x of [0.5, 0.3, 0.7])
      for (const y of [0.5, 0.3, 0.7]) {
        const p = new DOMPoint(b.x + b.width * x, b.y + b.height * y);
        const q = p.matrixTransform(path.getScreenCTM());
        if (
          path.isPointInFill(p) &&
          document.elementFromPoint(q.x, q.y) === path
        )
          return { x: q.x, y: q.y };
      }
    throw new Error("No municipality interior available for pointer selection");
  });
  await page.mouse.click(municipalityClick.x, municipalityClick.y);
  await expect(page.locator(".map-detail")).toContainText("Los Baños");
  await page
    .getByRole("button", { name: "Close municipality details" })
    .click();
  await search.fill("Manila");
  await expect(
    page.getByText("No matching Laguna municipalities"),
  ).toBeVisible();
  await search.fill("");
  for (const [name, legend] of [
    ["Population density", "population density"],
    ["Flood risk", "Flood"],
    ["Morbidity", "Morbidity"],
    ["Overall need", "Overall"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".map-legend")).toContainText(legend);
  }
  const hospitals = page.getByLabel("Hospitals & medical facilities", {
    exact: true,
  });
  await hospitals.uncheck();
  await expect(page.locator(".map-symbol.hospital")).toHaveCount(0);
  await hospitals.check();
  assert.ok((await page.locator(".map-symbol.hospital").count()) > 0);
  await page.getByRole("button", { name: "Recenter", exact: true }).click();
  const width = await los.evaluate((p) => p.getBoundingClientRect().width);
  for (let i = 0; i < 12; i++)
    await page.locator(".leaflet-control-zoom-out").click({ force: true });
  assert.ok(
    (await los.evaluate((p) => p.getBoundingClientRect().width)) >= width * 0.9,
  );
  for (const direction of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(700, 500);
      await page.mouse.down();
      await page.mouse.move(700 + direction * 400, 500 + direction * 120, {
        steps: 10,
      });
      await page.mouse.up();
      await page.waitForTimeout(300);
    }
    assert.ok(
      await page.locator(".risk-map").evaluate((container) => {
        const box = container.getBoundingClientRect(),
          x = box.width / 2,
          y = box.height / 2;
        const areas = [
          ...container.querySelectorAll("path.municipality-marker"),
        ].map((p) => p.getBoundingClientRect());
        return (
          x >= Math.min(...areas.map((r) => r.left)) - 3 &&
          x <= Math.max(...areas.map((r) => r.right)) + 3 &&
          y >= Math.min(...areas.map((r) => r.top)) - 3 &&
          y <= Math.max(...areas.map((r) => r.bottom)) + 3
        );
      }),
    );
  }
  await page.getByRole("button", { name: "Recenter", exact: true }).click();
  await page
    .getByRole("button", { name: "Administrator sign in", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Username", exact: true })
    .fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Clinic Optimization", exact: true })
    .click();
  const opt = page.getByRole("region", {
    name: "Clinic Optimization",
    exact: true,
  });
  await opt
    .getByRole("spinbutton", { name: "Available clinics (K)" })
    .first()
    .fill("2");
  const generate = opt
    .getByRole("button", { name: "Generate recommendation", exact: true })
    .first();
  await generate.click();
  await expect(
    opt.getByRole("heading", { name: "Recommended staging locations" }),
  ).toBeVisible();
  await expect(
    opt.getByText("OMCM vs. population baseline", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".fleet-marker")).toHaveCount(2);
  await opt
    .getByLabel("Place clinics manually at candidate sites", { exact: true })
    .check();
  await opt
    .getByRole("group", { name: "Manual placement (up to K sites)" })
    .locator('input[type="checkbox"]:not(:disabled)')
    .first()
    .check();
  await generate.click();
  await expect(page.locator(".fleet-marker")).toHaveCount(1);
  await opt
    .getByLabel("Place clinics manually at candidate sites", { exact: true })
    .uncheck();
  await generate.click();
  await expect(page.locator(".fleet-marker")).toHaveCount(2);
  await opt
    .getByRole("link", { name: "Accept recommendation & review" })
    .click();
  await opt
    .getByRole("button", { name: "Approve and publish", exact: true })
    .click();
  await expect(page.locator(".workspace-alerts")).toContainText("approved");
  const schedules = async () =>
    await (await fetch("http://127.0.0.1:8001/api/schedules")).json();
  const published = await schedules();
  await opt.getByLabel("Sensitivity top K").fill("4");
  await expect(opt.getByText(/Top 4 membership:/)).toBeVisible();
  await opt
    .getByRole("button", { name: "Close Clinic Optimization", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "Simulation Mode: Off", exact: true })
    .click();
  const sim = page.getByRole("region", {
    name: "Scenario builder",
    exact: true,
  });
  const readyScenario = () =>
    expect(sim.getByText(/Scenario ready/)).toBeVisible({ timeout: 60000 });
  await readyScenario();
  await page.getByRole("button", { name: "Flood risk", exact: true }).click();
  const bayFloodBefore = await page
    .locator("path.area-403402000")
    .getAttribute("fill");
  await sim
    .getByLabel("Scenario municipality", { exact: true })
    .selectOption({ label: "Bay" });
  await sim.getByLabel("Municipal flood severity", { exact: true }).fill("2");
  await sim.getByLabel("Municipal morbidity spike", { exact: true }).fill("2");
  await sim
    .getByRole("button", { name: "Apply municipality conditions" })
    .click();
  await readyScenario();
  await expect(
    sim.getByText("Bay: flood severe, morbidity 2×", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("path.area-403402000")).not.toHaveAttribute(
    "fill",
    bayFloodBefore,
  );
  await sim
    .getByLabel("Scenario municipality", { exact: true })
    .selectOption({ label: "Los Baños" });
  await sim
    .getByLabel("Municipal morbidity spike", { exact: true })
    .fill("1.5");
  await sim
    .getByRole("button", { name: "Apply municipality conditions" })
    .click();
  await readyScenario();
  await expect(
    sim.getByText("Los Baños: flood none, morbidity 1.5×", { exact: true }),
  ).toBeVisible();
  await sim
    .getByRole("button", { name: "Reset municipality", exact: true })
    .click();
  await readyScenario();
  await expect(
    sim.getByText("Los Baños: flood none, morbidity 1.5×", { exact: true }),
  ).toHaveCount(0);
  await sim
    .getByRole("button", { name: "Reset all conditions", exact: true })
    .click();
  await readyScenario();
  await selectTown("Los Baños");
  const click = await page
    .locator('.general-road-segment[stroke="#64748b"]')
    .evaluateAll((paths) => {
      for (const path of paths) {
        const p = path
          .getPointAtLength(path.getTotalLength() / 2)
          .matrixTransform(path.getScreenCTM());
        if (
          p.x > 460 &&
          p.x < 930 &&
          p.y > 250 &&
          p.y < 750 &&
          document.elementFromPoint(p.x, p.y) === path
        )
          return { x: p.x, y: p.y };
      }
      throw new Error("No exposed road segment");
    });
  await page.mouse.click(click.x, click.y);
  await expect(
    sim.getByRole("heading", { name: "Blocked roads (1)", exact: true }),
  ).toBeVisible();
  await readyScenario();
  await expect(
    page.locator('.general-road-segment[stroke="#dc2626"]').first(),
  ).toBeVisible();
  await sim.getByRole("button", { name: "Undo road change" }).click();
  await readyScenario();
  await expect(
    sim.getByRole("heading", { name: "Blocked roads (0)", exact: true }),
  ).toBeVisible();
  await sim
    .getByRole("button", { name: "Play deployment", exact: true })
    .click();
  await page.waitForTimeout(500);
  await sim
    .getByRole("button", { name: "Pause deployment", exact: true })
    .click();
  const elapsed = await sim.getByTestId("simulation-clock").textContent();
  assert.notEqual(elapsed, "0.0 simulated seconds");
  await page.waitForTimeout(300);
  assert.equal(
    await sim.getByTestId("simulation-clock").textContent(),
    elapsed,
  );
  await sim.getByLabel("Simulation speed", { exact: true }).selectOption("60");
  await sim.getByTestId("fleet-MC-001").click();
  const clinic = page.getByRole("region", { name: "Selected clinic tracking" });
  for (const text of [
    "Patient load",
    "Barangays served:",
    "Services:",
    "SIMULATED",
  ])
    await expect(clinic).toContainText(text);
  await screenshot("map-first-simulation-desktop");
  await clinic.getByRole("button", { name: "Close clinic details" }).click();
  assert.deepEqual(await schedules(), published);
  await page
    .getByRole("button", { name: "AI chatbot: Closed", exact: true })
    .click();
  const chat = page.getByRole("region", { name: "AI chatbot", exact: true });
  for (const [index, question] of [
    "Why these need factors and clinic capacity?",
    "What changed after the scenario?",
  ].entries()) {
    await chat.getByLabel("Chat message", { exact: true }).fill(question);
    await chat
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(chat.locator(".chat-message.assistant")).toHaveCount(
      index + 1,
      { timeout: 60000 },
    );
  }
  await expect(chat).toContainText("Template explanation");
  await expect(chat).toContainText("LGU health officers");
  await screenshot("map-first-chat-desktop");
  await chat.getByRole("button", { name: "Collapse chatbot" }).click();
  await page
    .getByRole("button", { name: "AI chatbot: Closed", exact: true })
    .click();
  await expect(chat.locator(".chat-message.assistant")).toHaveCount(2);
  await chat.getByRole("button", { name: "Collapse chatbot" }).click();
  await page
    .getByRole("switch", { name: "Simulation Mode: On", exact: true })
    .click();
  await expect(page.locator(".simulation-badge")).toHaveCount(0);
  await expect(page.locator(".fleet-marker")).toHaveCount(2);
  assert.deepEqual(await schedules(), published);
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot("map-first-mobile");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page
    .getByRole("button", { name: "Clinic Optimization", exact: true })
    .click();
  await screenshot("map-first-mobile-panel");
  assert.ok(
    (await opt.boundingBox()).height <
      (await page.locator(".risk-map").boundingBox()).height * 0.6,
  );
  await page.goto(`${base}/public`);
  await page.getByLabel("Schedule date", {exact: true}).fill(published.schedules[0].date);
  await expect(page.locator(".public-clinic")).toHaveCount(2);
  await expect(page.locator(".map-symbol.clinic")).toHaveCount(2);
  await expect(page.locator("path.municipality-marker")).toHaveCount(30);
  assert.equal(
    await page
      .getByRole("button", { name: "Generate recommendation", exact: true })
      .count(),
    0,
  );
  await screenshot("map-first-public");
  const missing = await browser.newPage();
  await missing.route("**/data/geo/laguna_municipalities.geojson", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await missing.goto(base);
  await expect(
    missing.getByRole("heading", {
      name: "Laguna geographic data unavailable",
    }),
  ).toBeVisible();
  await expect(missing.locator(".risk-map")).toHaveCount(0);
  await missing.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: map-first desktop/mobile, boundaries/bounds/mask, search/metrics/facilities, optimization/manual/approval/public, municipal scenarios/road blocking/playback/clinic details, chat history/template fallback.",
  );
} finally {
  if (errors.length) console.error("Browser errors:", errors);
  if (page) {
    await mkdir("test-results", { recursive: true });
    await page
      .screenshot({ path: "test-results/map-first-final.png", fullPage: true })
      .catch(() => {});
  }
  await browser?.close();
  for (const process of processes) process.kill();
  await rm(temp, { recursive: true, force: true });
}
