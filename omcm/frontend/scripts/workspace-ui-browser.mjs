import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("..", import.meta.url));
const backend = fileURLToPath(new URL("../../backend", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "omcm-workspace-ui-"));
const username = "ui-browser-test";
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
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8013"],
    backend,
    {
      OMCM_DATASET: "pilot",
      OMCM_DATABASE_PATH: join(temporary, "simulation.db"),
      OMCM_DEMO_AUTH: "true",
      OMCM_ADMIN_USERNAME: username,
      OMCM_ADMIN_PASSWORD: password,
    },
  );
  await ready("http://127.0.0.1:8013/api/health", api);
  const vite = start(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5186",
      "--strictPort",
    ],
    frontend,
    {
      VITE_DEMO_MODE: "false",
      VITE_API_URL: "",
      VITE_GOOGLE_MAPS_API_KEY: "",
      OMCM_PROXY_TARGET: "http://127.0.0.1:8013",
    },
  );
  await ready("http://127.0.0.1:5186", vite);
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
  const artifacts = join(frontend, "test-results");
  await mkdir(artifacts, { recursive: true });
  async function shot(name) {
    await page.screenshot({
      path: join(artifacts, `ui-${name}.png`),
      animations: "disabled",
    });
  }
  async function noOverflow() {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  async function withinViewport(locator) {
    await locator.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {}))));
    const size = page.viewportSize();
    await expect
      .poll(
        async () => {
          const current = await locator.boundingBox();
          return current
            ? Math.max(
                -current.x,
                -current.y,
                current.x + current.width - size.width,
                current.y + current.height - size.height,
              )
            : Infinity;
        },
        { message: "Floating surface must settle inside the viewport" },
      )
      .toBeLessThanOrEqual(1);
    const box = await locator.boundingBox();
    expect(box).toBeTruthy();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
    return box;
  }
  async function publicDetails() {
    const panel = page.getByRole("complementary", {
      name: "Community care and schedules",
    });
    if (!(await panel.isVisible()))
      await page
        .getByRole("button", { name: "Show or hide community details" })
        .click();
    return panel;
  }
  await page.goto("http://127.0.0.1:5186", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".barangay-boundary")).toHaveCount(681, {
    timeout: 90000,
  });
  await page.evaluate(() => {
    window.__uiOriginalMap = document.querySelector(".leaflet-container");
  });
  let publicPanel = await publicDetails();
  await expect(
    publicPanel.getByRole("region", { name: "Published clinic visits" }),
  ).toBeVisible();
  await shot("public-empty-desktop");
  const search = page.getByRole("combobox", {
    name: "Find municipality or barangay",
  });
  await search.fill("Los Banos");
  await shot("search-desktop");
  await page.getByRole("option", { name: /Los Baños Municipality/ }).click();
  await expect(
    publicPanel.getByRole("heading", { name: "Los Baños", exact: true }),
  ).toBeVisible();
  await shot("public-care-desktop");
  const source = publicPanel.locator(".place-care-source").first();
  await source.locator("summary").click();
  await expect(source.locator(".place-source-body")).toBeVisible();
  await shot("hospital-source-desktop");
  await publicPanel.locator(".workspace-panel-body").evaluate((element) => {
    element.scrollTop = 0;
  });

  // Seed one real approved visit into this test's isolated database.
  const authHeaders = {
    Authorization:
      "Basic " + Buffer.from(username + ":" + password).toString("base64"),
  };
  const health = await (await fetch("http://127.0.0.1:8013/api/health")).json();
  const tomorrow = new Date(`${health.today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const planResponse = await fetch(
    "http://127.0.0.1:8013/api/planning/optimize",
    {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        clinic_count: 1,
        max_travel_minutes: 0,
        manual_sites: ["LP-403402001"],
      }),
    },
  );
  expect(planResponse.status).toBe(200);
  const plan = await planResponse.json();
  const publish = await fetch("http://127.0.0.1:8013/api/schedules/approve", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_id: plan.plan_id,
      deployment_date: tomorrow.toISOString().slice(0, 10),
    }),
  });
  expect(publish.status).toBe(200);
  await publicPanel
    .getByRole("button", { name: "Refresh published visits" })
    .click();
  await publicPanel.getByRole("button", { name: /Next clinic day/ }).click();
  await expect(
    publicPanel.getByText("1 clinic announced", { exact: true }),
  ).toBeVisible();
  await shot("public-visit-desktop");

  await page
    .getByRole("button", { name: "Admin View", exact: true })
    .first()
    .click();
  const login = page.getByRole("dialog", { name: "Administrator Sign-In" });
  await shot("login-desktop");
  await login.getByLabel("Administrator username").fill(username);
  await login.getByLabel("Password", { exact: true }).fill(password);
  await login
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(login.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await login
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await login
    .getByRole("button", { name: "Sign in to Admin View", exact: true })
    .click();
  await expect(page.locator(".workspace")).toHaveClass(/is-admin-view/);
  await shot("admin-details-desktop");
  await search.fill("Dambo Pangil");
  await page.getByRole("option", { name: /^Dambo, Pangil Barangay/ }).click();
  await expect(
    page.getByRole("complementary", { name: "Barangay details", exact: true }),
  ).toBeVisible();
  await shot("barangay-desktop");
  await page.getByRole("button", { name: "Plan clinics", exact: true }).click();
  const planner = page.getByRole("complementary", {
    name: "Plan clinic locations",
    exact: true,
  });
  await expect(
    planner.getByRole("button", { name: "Generate recommendations" }),
  ).toBeEnabled({ timeout: 20000 });
  const capacityBox = await planner
    .getByLabel("Daily capacity per clinic")
    .boundingBox();
  const travelBox = await planner
    .getByLabel("Maximum modeled travel minutes")
    .boundingBox();
  expect(Math.abs(capacityBox.y - travelBox.y)).toBeLessThanOrEqual(1);
  await shot("planner-desktop");

  await page
    .getByRole("button", { name: "30-day simulation", exact: true })
    .click();
  const panel = page.getByRole("complementary", {
    name: "Try a 30-day clinic plan",
  });
  await panel
    .getByRole("button", { name: /^Manual clinic allocation/ })
    .click();
  const picker = panel.getByRole("combobox", {
    name: "MC-1 barangay",
    exact: true,
  });
  await picker.fill("Pangil");
  await expect(
    page.getByRole("listbox", { name: "MC-1 barangay options" }),
  ).toBeVisible();
  await shot("picker-desktop");
  await picker.press("ArrowDown");
  await picker.press("Enter");
  await expect(picker).toHaveAttribute("aria-expanded", "false");
  await expect(picker).not.toHaveValue("");
  // A preselected location must remain searchable and keyboard-editable too.
  await picker.fill("Los Banos");
  await expect(
    page.getByRole("listbox", { name: "MC-1 barangay options" }),
  ).toBeVisible();
  await picker.press("ArrowDown");
  await picker.press("Enter");
  await expect(picker).toHaveValue(/Los Baños/);

  for (const size of [
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 760, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await noOverflow();
    const sheet = await withinViewport(panel);
    const playback = await withinViewport(
      page.getByRole("region", { name: "Simulation playback" }),
    );
    expect(
      await page
        .getByRole("region", { name: "Simulation playback" })
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
    const launcher = page.getByRole("button", {
      name: "Open OMCM assistant (Drag to reposition)",
    });
    if (await launcher.isVisible()) {
      const box = await launcher.boundingBox();
      const overlap =
        Math.max(
          0,
          Math.min(box.x + box.width, playback.x + playback.width) -
            Math.max(box.x, playback.x),
        ) *
        Math.max(
          0,
          Math.min(box.y + box.height, playback.y + playback.height) -
            Math.max(box.y, playback.y),
        );
      expect(overlap).toBe(0);
    }
    if (size.width > 760 && size.height < 560) {
      await panel.getByRole("button", { name: "Expand panel height" }).click();
      expect((await withinViewport(panel)).height).toBeGreaterThan(
        sheet.height,
      );
      await shot("landscape-expanded");
      await panel.getByRole("button", { name: "Reduce panel height" }).click();
    }

    if (size.width <= 760) {
      expect(sheet.y + sheet.height).toBeLessThanOrEqual(playback.y);
      const legend = await withinViewport(
        page.getByRole("region", { name: "Map legend" }),
      );
      expect(legend.y + legend.height).toBeLessThanOrEqual(sheet.y);
      if (size.width === 390) {
        const grip = await panel
          .getByRole("button", { name: "Resize map panel" })
          .boundingBox();
        await page.mouse.move(grip.x + grip.width / 2, grip.y + 12);
        await page.mouse.down();
        await page.mouse.move(grip.x + grip.width / 2, grip.y - 60, {
          steps: 6,
        });
        await page.mouse.up();
        await expect(panel).toHaveClass(/is-expanded/);
      } else
        await panel
          .getByRole("button", { name: "Expand panel height" })
          .click();
      const expanded = await withinViewport(panel);
      expect(expanded.height).toBeGreaterThan(sheet.height);
      await picker.fill("Los Banos");
      await expect(
        page.getByRole("listbox", { name: "MC-1 barangay options" }),
      ).toBeVisible();
      await withinViewport(page.locator(".workspace-picker"));
      await shot(`picker-${size.width}`);
      await picker.press("Escape");
      await expect(page.locator(".workspace-picker")).toHaveCount(0);
      await panel.getByRole("button", { name: "Reduce panel height" }).click();
    }
    await panel.locator(".workspace-panel-body").evaluate((element) => {
      element.scrollTop = 0;
    });
    await shot(`simulation-${size.width}x${size.height}`);
    await panel.getByRole("button", { name: "Collapse tool panel" }).click();
    await expect(panel.locator(".workspace-panel-body")).toBeHidden();
    await withinViewport(panel);
    await panel.getByRole("button", { name: "Expand tool panel" }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Planning help", exact: true })
    .click();
  const assistant = page.getByRole("region", {
    name: "OMCM assistant",
    exact: true,
  });
  await expect(assistant).toBeVisible();
  await withinViewport(assistant);
  await shot("assistant-mobile");
  await assistant.getByLabel("Assistant message").press("Escape");
  await expect(assistant).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Planning help", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        window.__uiOriginalMap === document.querySelector(".leaflet-container"),
    ),
  ).toBe(true);
  expect(new URL(page.url()).pathname).toBe("/admin");

  await panel.getByRole("button", { name: "Close tool panel" }).click();
  await page.getByRole("button", { name: "Public View", exact: true }).click();
  publicPanel = await publicDetails();
  await shot("public-mobile");
  await publicPanel
    .getByRole("button", { name: "Expand place details" })
    .click();
  await withinViewport(publicPanel);
  await shot("public-mobile-expanded");
  await publicPanel
    .getByRole("button", { name: "Collapse place details" })
    .click();
  await publicPanel
    .getByRole("button", { name: "Close community details" })
    .click();
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await withinViewport(page.getByRole("region", { name: "Map filters" }));
  await shot("layers-mobile");
  await page.getByRole("button", { name: "Close map filters" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: /OpenStreetMap · Map settings/ })
    .click();
  const settings = page.getByRole("dialog", {
    name: "Map settings",
    exact: true,
  });
  await withinViewport(settings);
  await shot("map-settings-desktop");
  await settings.getByRole("button", { name: "Close dialog" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Show or hide community details" })
    .click();
  expect(
    await page
      .locator(".workspace-panel")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  expect(errors, logs).toEqual([]);
  console.log(
    "Workspace UI browser checks passed: public empty/published care, search, sign-in/password visibility, aligned planner fields, keyboard/viewport-safe pickers, desktop/tablet/mobile/landscape sheets with tap/swipe resizing, playback, assistant focus, filters, settings, reduced motion and one persistent map. Screenshots:",
    artifacts,
  );
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: "/tmp/omcm-ui-browser-failure.png" });
    console.log(
      await page
        .locator(".workspace-picker, .workspace-panel")
        .evaluateAll((elements) =>
          elements.map((element) => ({
            className: element.className,
            rect: element.getBoundingClientRect().toJSON(),
            style: element.getAttribute("style"),
          })),
        ),
    );
  }
  throw new Error(error + "\n" + logs);
} finally {
  await browser?.close();
  await Promise.all(processes.map(stop));
  await rm(temporary, { recursive: true, force: true });
}
