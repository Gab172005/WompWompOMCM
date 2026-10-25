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
    await locator.evaluate((element) =>
      Promise.all(
        element
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
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
  async function playbackAlignment() {
    const centers = await page
      .getByRole("region", { name: "Simulation playback" })
      .evaluate((element) =>
        [
          ".playback-play",
          ".playback-rewind",
          ".workspace-timeline input",
          "output",
          ".playback-next",
          ".playback-speed select",
        ].map((selector) => {
          const box = element.querySelector(selector).getBoundingClientRect();
          return box.top + box.height / 2;
        }),
      );
    expect(
      Math.max(...centers) - Math.min(...centers),
      "Playback controls must share the slider's center line",
    ).toBeLessThanOrEqual(1.5);
  }
  await page.goto("http://127.0.0.1:5186", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".barangay-boundary")).toHaveCount(681, {
    timeout: 90000,
  });
  const alphaChecks = await page.evaluate(async () => {
    return Promise.all(
      [
        "/omcm-icon.svg",
        "/favicon-32.png",
        "/favicon-96.png",
        "/apple-touch-icon.png",
        // Separate the inspection request from Chrome's automatic favicon load.
        "/favicon.ico?alpha-check=1",
      ].map(async (src) => {
        const icon = new Image();
        icon.src = src;
        try {
          await icon.decode();
        } catch (error) {
          throw new Error(`${src}: ${String(error)}`);
        }
        const canvas = document.createElement("canvas");
        canvas.width = icon.naturalWidth;
        canvas.height = icon.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(icon, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        const alpha = Array.from(
          { length: pixels.length / 4 },
          (_, index) => pixels[index * 4 + 3],
        );
        return {
          src,
          width: canvas.width,
          transparent: alpha.filter((value) => value === 0).length,
          opaque: alpha.filter((value) => value > 0).length,
          total: alpha.length,
          corner: pixels[3],
        };
      }),
    );
  });
  for (const icon of alphaChecks) {
    expect(icon.corner, icon.src).toBe(0);
    expect(icon.transparent, icon.src).toBeGreaterThan(icon.total * 0.5);
    expect(icon.opaque, icon.src).toBeGreaterThan(icon.total * 0.1);
  }
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
  await search.fill("Casile Cabuyao");
  await page.getByRole("option", { name: /^Casile, Cabuyao Barangay/ }).click();
  await expect(publicPanel.getByText(/No clinic visits announced/)).toHaveCount(
    1,
  );
  await expect(
    publicPanel.getByRole("region", { name: "Nearest published clinic visit" }),
  ).toHaveCount(0);
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    const expand = publicPanel.getByRole("button", {
      name: "Expand place details",
    });
    if (await expand.isVisible()) await expand.click();
    await publicPanel.locator(".workspace-panel-body").evaluate((element) => {
      element.scrollTop = 0;
    });
    await withinViewport(publicPanel);
    expect(
      await publicPanel.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    const inset = await publicPanel
      .locator(".workspace-panel-heading")
      .evaluate((element) => {
        const box = element.getBoundingClientRect();
        const title = element.querySelector("h2").getBoundingClientRect();
        return title.left - box.left;
      });
    expect(inset).toBeGreaterThanOrEqual(12);
    const facts = publicPanel.getByRole("region", {
      name: "Selected community care",
    });
    await expect(facts.getByText("4,661", { exact: true })).toBeVisible();
    await expect(facts.getByText("2,229", { exact: true })).toBeVisible();
    await shot(`public-casile-empty-${size.width}`);
    await publicPanel
      .getByRole("region", { name: "Nearby verified hospitals" })
      .scrollIntoViewIfNeeded();
    await shot(`public-casile-hospitals-${size.width}`);
    const reduce = publicPanel.getByRole("button", {
      name: "Collapse place details",
    });
    if (await reduce.isVisible()) await reduce.click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await publicPanel.getByRole("button", { name: "All Laguna" }).click();
  await expect(
    publicPanel.getByRole("region", { name: "Selected community care" }),
  ).toHaveCount(0);
  await page.locator("body").click({ position: { x: 700, y: 100 } });
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
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
  await expect(
    publicPanel
      .getByRole("region", { name: "Nearest published clinic visit" })
      .getByRole("button"),
  ).toBeVisible();
  const clinicAction = publicPanel
    .getByRole("button", { name: /^View MC-.* visit details$/ })
    .first();
  await clinicAction.click();
  const visitDialog = page.getByRole("dialog", { name: /^MC-/ });
  await expect(
    visitDialog.getByRole("region", { name: "Approved clinic visit" }),
  ).toBeVisible();
  await expect(
    visitDialog.getByText(/not a booking or a live count/),
  ).toBeVisible();
  await expect(
    visitDialog.getByText(/XGBoost|Healthcare Need|Forecast target/),
  ).toHaveCount(0);
  await shot("public-visit-dialog-desktop");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await withinViewport(visitDialog);
    await noOverflow();
    await shot(`public-visit-dialog-${width}`);
  }
  await visitDialog.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await publicPanel.locator(".care-visit-information summary").first().click();
  await expect(
    publicPanel.getByText(/Capacity is a planning estimate/).first(),
  ).toBeVisible();
  await shot("public-visit-desktop");
  for (const size of [
    { width: 390, height: 844 },
    { width: 320, height: 740 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    const expander = publicPanel.getByRole("button", {
      name: "Expand place details",
    });
    if (await expander.isVisible()) await expander.click();
    await publicPanel
      .locator(".public-clinic-card")
      .first()
      .scrollIntoViewIfNeeded();
    expect(
      await publicPanel
        .locator(".public-clinic-card")
        .first()
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
    await noOverflow();
    await shot(`public-clinic-${size.width}`);
    const reduce = publicPanel.getByRole("button", {
      name: "Collapse place details",
    });
    if (await reduce.isVisible()) await reduce.click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

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
  await planner
    .locator('summary[aria-label="Behind your recommendations"]')
    .click();
  await expect(
    planner.getByText("Estimate tomorrow’s demand", { exact: true }),
  ).toBeVisible();
  await planner
    .locator('summary[aria-label="Understand flood layers"]')
    .focus();
  await page.keyboard.press("Enter");
  await expect(planner.locator(".flood-likelihoods")).toBeVisible();
  const restrictions = planner
    .locator(".map-disclosure")
    .filter({ has: page.locator('summary[aria-label="Access restrictions"]') });
  await restrictions.locator("summary").click();
  await restrictions.getByRole("checkbox").first().check();
  await expect(
    restrictions.getByText("1 excluded", { exact: true }),
  ).toBeVisible();
  await restrictions.getByRole("searchbox").fill("no-place-matches-this");
  await expect(
    restrictions.getByText("No connections found. Try another place name."),
  ).toBeVisible();
  await restrictions.getByRole("button", { name: "Clear exclusions" }).click();
  await expect(
    restrictions.getByText("Optional", { exact: true }),
  ).toBeVisible();
  await restrictions.getByRole("searchbox").fill("Los Baños");
  await expect(restrictions.getByRole("checkbox").first()).toBeVisible();
  // Focusing deep content must scroll the body without moving its heading.
  const plannerBox = await planner.boundingBox();
  const headingBox = await planner
    .locator(".workspace-panel-heading")
    .boundingBox();
  expect(headingBox.y).toBeGreaterThanOrEqual(plannerBox.y);
  expect(headingBox.y).toBeLessThan(plannerBox.y + 24);
  await planner.locator(".workspace-panel-body").evaluate((element) => {
    element.scrollTop = 0;
  });
  await shot("planner-desktop");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const button of await page
      .getByRole("navigation", { name: "Planning tools" })
      .getByRole("button")
      .all())
      await withinViewport(button);
    for (const button of await page
      .getByRole("navigation", { name: "Map layers and colors" })
      .getByRole("button")
      .all())
      await withinViewport(button);
    await page.getByRole("button", { name: "Map layers", exact: true }).click();
    const layerPicker = page.getByRole("region", { name: "Map filters" });
    await withinViewport(layerPicker);
    await layerPicker.getByText("Population", { exact: true }).click();
    await expect(
      layerPicker.getByRole("radio", { name: "People per square kilometre" }),
    ).toBeChecked();
    await expect(
      page
        .getByRole("navigation", { name: "Map layers and colors" })
        .getByRole("button", { name: "Population", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await shot(`map-details-admin-${width}`);
    await layerPicker
      .getByRole("radio", { name: "People per square kilometre" })
      .focus();
    await page.keyboard.press("ArrowLeft");
    await expect(
      layerPicker.getByRole("radio", { name: "Healthcare Need Score" }),
    ).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(layerPicker).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Map layers", exact: true }),
    ).toBeFocused();
    await planner.getByRole("button", { name: "Expand panel height" }).click();
    for (const title of [
      "Behind your recommendations",
      "Understand flood layers",
      "Access restrictions",
    ]) {
      const card = planner
        .locator(".map-disclosure")
        .filter({ has: page.locator(`summary[aria-label="${title}"]`) });
      await card.scrollIntoViewIfNeeded();
      expect(
        await card.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
      await shot(`planner-${title.split(" ")[0].toLowerCase()}-${width}`);
    }
    await noOverflow();
    await planner.getByRole("button", { name: "Reduce panel height" }).click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

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

  const mapLegend = page.getByRole("region", { name: "Map legend" });
  await mapLegend.getByRole("button", { name: "Show map symbols" }).click();
  await mapLegend
    .getByRole("button", { name: "Data & guidance", exact: true })
    .click();
  await expect(
    mapLegend.getByRole("region", { name: "Map data and guidance" }),
  ).toBeVisible();
  await expect(mapLegend.locator("time")).toContainText("PH time");
  await expect(mapLegend.locator("time")).not.toContainText(/T\d{2}:/);
  await shot("legend-guidance-desktop");
  await mapLegend
    .getByRole("group", { name: "Legend details", exact: true })
    .focus();
  await page.keyboard.press("End");
  await expect(
    mapLegend.getByRole("region", { name: "Clinic data source", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      mapLegend
        .getByRole("group", { name: "Legend details", exact: true })
        .evaluate(
          (element) =>
            element.scrollHeight - element.clientHeight - element.scrollTop,
        ),
    )
    .toBeLessThanOrEqual(1);
  await shot("legend-source-desktop");
  const legendHeader = await mapLegend
    .locator(".workspace-legend-header-main")
    .boundingBox();
  await page.mouse.move(legendHeader.x + 12, legendHeader.y + 10);
  await page.mouse.down();
  await page.mouse.move(1370, 950, { steps: 8 });
  await page.mouse.up();
  await expect(mapLegend).toHaveClass(/is-positioned/);
  await withinViewport(mapLegend);
  await mapLegend
    .getByRole("button", { name: "Map symbols", exact: true })
    .click();
  await withinViewport(mapLegend);
  await shot("legend-symbols-positioned");
  await mapLegend
    .getByRole("button", { name: "Reset legend to default position" })
    .click();
  await mapLegend.getByRole("button", { name: "Minimize map legend" }).click();
  const compactCenters = await mapLegend.evaluate((element) =>
    [".workspace-legend-minimized-info", ".workspace-legend-actions"].map(
      (selector) => {
        const box = element.querySelector(selector).getBoundingClientRect();
        return box.y + box.height / 2;
      },
    ),
  );
  expect(Math.abs(compactCenters[0] - compactCenters[1])).toBeLessThanOrEqual(
    1.5,
  );
  await playbackAlignment();
  const compactLegend = await mapLegend.boundingBox();
  const desktopClock = await page
    .getByRole("region", { name: "Simulation playback" })
    .boundingBox();
  expect(
    desktopClock.y - compactLegend.y - compactLegend.height,
  ).toBeGreaterThanOrEqual(8);
  await shot("compact-legend-playback-desktop");
  await mapLegend.getByRole("button", { name: "Expand map legend" }).click();
  await mapLegend.getByRole("button", { name: "Hide map symbols" }).click();
  await panel.locator('summary[aria-label="How to compare"]').click();
  await expect(
    panel.getByText("Area count alone does not measure need reduced.", {
      exact: false,
    }),
  ).toBeVisible();
  await panel.locator(".workspace-panel-body").evaluate((element) => {
    element.scrollTop = 0;
  });
  await shot("scenario-picker-desktop");

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
    await playbackAlignment();
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
      await mapLegend.getByRole("button", { name: "Show map symbols" }).click();
      await mapLegend
        .getByRole("button", { name: "Data & guidance", exact: true })
        .click();
      await withinViewport(mapLegend);
      await expect(
        mapLegend.getByRole("button", { name: "Hide map symbols" }),
      ).toBeVisible();
      expect(
        await mapLegend.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
      await shot(`legend-guidance-${size.width}`);
      await mapLegend
        .getByRole("group", { name: "Legend details", exact: true })
        .focus();
      await page.keyboard.press("End");
      await expect(mapLegend.locator("time")).toBeVisible();
      await expect
        .poll(() =>
          mapLegend
            .getByRole("group", { name: "Legend details", exact: true })
            .evaluate(
              (element) =>
                element.scrollHeight - element.clientHeight - element.scrollTop,
            ),
        )
        .toBeLessThanOrEqual(1);
      await shot(`legend-source-${size.width}`);
      await mapLegend.getByRole("button", { name: "Hide map symbols" }).click();
      const firstScenario = panel.getByRole("button", {
        name: /^No intervention/,
      });
      const lastScenario = panel.getByRole("button", {
        name: /^Optimized clinic allocation/,
      });
      await panel.locator(".workspace-panel-body").evaluate((element) => {
        element.scrollTop = 0;
      });
      const firstScenarioBox = await firstScenario.boundingBox();
      const lastScenarioBox = await lastScenario.boundingBox();
      expect(lastScenarioBox.y + lastScenarioBox.height).toBeLessThanOrEqual(
        sheet.y + sheet.height + 1,
      );
      expect(firstScenarioBox.y).toBeGreaterThan(sheet.y);
      await shot(`scenario-choices-${size.width}`);
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
  await panel.getByRole("button", { name: "Expand panel height" }).click();
  await panel
    .locator('summary[aria-label="Compare the three scenarios"]')
    .click();
  await expect(panel.locator(".scenario-comparison-card")).toHaveCount(3);
  await panel.locator(".scenario-comparison-list").scrollIntoViewIfNeeded();
  expect(
    await panel
      .locator(".scenario-comparison-list")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  await shot("comparison-mobile");
  await panel
    .locator('summary[aria-label="Clinic deployment history"]')
    .click();
  await panel
    .getByText("No clinics deployed in this scenario yet.", { exact: false })
    .scrollIntoViewIfNeeded();
  await shot("deployment-history-mobile");
  await panel.getByRole("button", { name: "Reduce panel height" }).click();
  await page
    .getByRole("button", { name: "Planning help", exact: true })
    .click();
  const assistant = page.getByRole("region", {
    name: "OMCM assistant",
    exact: true,
  });
  await expect(assistant).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Planning help", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await withinViewport(assistant);
  await expect(
    assistant.getByRole("button", { name: /Find priority communities/ }),
  ).toBeVisible();
  await shot("assistant-mobile");
  for (const size of [
    { width: 320, height: 740 },
    { width: 844, height: 390 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    await withinViewport(assistant);
    const composer = assistant.locator(".assistant-composer");
    await withinViewport(composer);
    const message = assistant.getByLabel("Assistant message");
    await message.fill(
      "A long question about finding community healthcare and mobile clinic visits. ".repeat(
        10,
      ),
    );
    expect(
      await message.evaluate((element) => element.offsetHeight),
    ).toBeLessThanOrEqual(144);
    await noOverflow();
    await shot(`assistant-${size.width}x${size.height}`);
    await message.fill("");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  // Emulate the visual viewport shrinking above an onscreen keyboard.
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, "height", {
      configurable: true,
      value: 430,
    });
    Object.defineProperty(visualViewport, "offsetTop", {
      configurable: true,
      value: 0,
    });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(async () => {
      const box = await assistant.locator(".assistant-composer").boundingBox();
      return box ? box.y + box.height : Infinity;
    })
    .toBeLessThanOrEqual(430);
  await shot("assistant-keyboard-viewport");
  await page.evaluate(() => {
    delete visualViewport.height;
    delete visualViewport.offsetTop;
    visualViewport.dispatchEvent(new Event("resize"));
  });
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
  await expect(
    page.getByRole("region", { name: "Map filters" }).getByRole("radio"),
  ).toHaveCount(0);
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
  await settings.getByText("OpenStreetMap", { exact: true }).click();
  await expect(
    settings.getByRole("radio", { name: "OpenStreetMap", exact: true }),
  ).toBeChecked();
  await settings
    .getByRole("radio", { name: "OpenStreetMap", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    settings.getByRole("radio", { name: "Google Maps", exact: true }),
  ).toBeChecked();
  await expect(
    settings.getByText("OpenStreetMap is active", { exact: true }),
  ).toBeVisible();
  await expect(settings.getByLabel("Google Maps API key")).toBeHidden();
  await settings.locator('summary[aria-label="Google Maps key"]').click();
  await expect(settings.getByLabel("Google Maps API key")).toBeVisible();
  await expect(
    settings.getByRole("button", { name: "Save key and reload map" }),
  ).toBeDisabled();
  await shot("map-settings-desktop");
  for (const size of [
    { width: 390, height: 844 },
    { width: 320, height: 740 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await withinViewport(settings);
    expect(
      await settings.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await shot(`map-settings-${size.width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
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
  await page.getByRole("button", { name: /Open OMCM assistant/ }).click();
  await expect(
    assistant.getByRole("button", { name: /Find nearby hospitals/ }),
  ).toBeVisible();
  await expect(
    assistant.getByRole("button", {
      name: /Find priority communities|Plan clinic locations|Understand the need score/,
    }),
  ).toHaveCount(0);
  await expect(search).toHaveValue("Dambo, Pangil");
  expect(
    await search.evaluate((element) => element.clientWidth),
  ).toBeGreaterThan(100);
  expect(await search.evaluate((element) => element.scrollLeft)).toBe(0);
  await shot("assistant-public-desktop");
  await assistant.getByRole("button", { name: "Close assistant" }).click();
  const touchPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  touchPage.on("pageerror", (error) => errors.push(error.message));
  await touchPage.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await touchPage.goto("http://127.0.0.1:5186");
  await expect(touchPage.locator(".barangay-boundary")).toHaveCount(681);
  expect(
    await touchPage.evaluate(() => matchMedia("(pointer: coarse)").matches),
  ).toBe(true);
  await touchPage.getByRole("button", { name: "Ask OMCM", exact: true }).tap();
  const touchAssistant = touchPage.getByRole("region", {
    name: "OMCM assistant",
    exact: true,
  });
  await expect(touchAssistant).toBeVisible();
  expect(
    await touchAssistant
      .locator(".assistant-chat-log")
      .evaluate((element) => element.scrollTop),
  ).toBe(0);
  expect(
    await touchPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await touchPage.screenshot({
    path: join(artifacts, "ui-assistant-touch-phone.png"),
    animations: "disabled",
  });
  await touchAssistant.getByRole("button", { name: "Close assistant" }).tap();
  await touchPage
    .getByRole("button", { name: "Map layers", exact: true })
    .tap();
  await expect(
    touchPage.getByRole("region", { name: "Map filters" }),
  ).toBeVisible();
  await touchPage
    .getByRole("checkbox", { name: "Hospitals", exact: true })
    .uncheck();
  await expect(touchPage.locator(".hospital-marker-custom")).toHaveCount(0);
  await touchPage.close();
  expect(errors, logs).toEqual([]);
  console.log(
    "Workspace UI browser checks passed: public empty/published care, search, sign-in/password visibility, aligned planner fields, keyboard disclosures, access filtering/reset, responsive scenario comparisons, view-aware assistant tasks/composer, favicons, keyboard/viewport-safe pickers, desktop/tablet/mobile/landscape sheets with tap/swipe resizing, playback, assistant focus, filters, settings, reduced motion and one persistent map. Screenshots:",
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
