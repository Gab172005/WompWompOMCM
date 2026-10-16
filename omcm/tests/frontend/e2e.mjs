import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(
  new URL("../../frontend/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const frontend = fileURLToPath(new URL("../../frontend", import.meta.url));
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5175",
    "--strictPort",
  ],
  {
    cwd: frontend,
    env: { ...process.env, VITE_DEMO_MODE: "true" },
    windowsHide: true,
    stdio: "pipe",
  },
);
let browser,
  log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(log);
    try {
      if ((await fetch("http://127.0.0.1:5175")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5175");
  await expect(
    page.getByRole("main", { name: "Laguna planning map" }),
  ).toBeVisible();
  await expect(page.locator(".workspace-topbar")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /^(Overview|Schedules)$/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Map navigation" }),
  ).toBeVisible();
  await expect(
    page.locator(".leaflet-overlay-pane path").first(),
  ).toBeAttached();
  await mkdir(resolve(frontend, "test-results"), { recursive: true });
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await page.screenshot({
    path: resolve(frontend, "test-results/workspace-map-desktop.png"),
  });
  await page.locator(".clinic-staging-marker").first().press("Enter");
  await expect(page.getByRole("dialog")).toContainText("MC-001");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Find municipality").fill("Bay");
  await page.getByLabel("Find municipality").press("ArrowDown");
  await page.getByLabel("Find municipality").press("Enter");
  await expect(
    page.getByRole("heading", { name: "Bay", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await page.getByLabel("Heatmap layer").selectOption("flood");
  await expect(page.getByLabel("Map legend")).toContainText("Flood exposure");
  await page
    .getByRole("checkbox", { name: "Hospitals", exact: true })
    .uncheck();
  await expect(page.locator(".hospital-marker-custom")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Map filters", { exact: true })).toHaveCount(0);
  const outline = page.locator(".leaflet-overlay-pane path").first();
  const geometry = await outline.getAttribute("d");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(outline).not.toHaveAttribute("d", geometry);
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page
    .getByRole("button", { name: "Recenter Laguna map", exact: true })
    .click();
  await page.getByRole("button", { name: "Optimize", exact: true }).click();
  await expect(page.getByLabel("Clinic optimization")).toBeVisible();
  await page.getByLabel("Available mobile clinics").fill("4");
  await expect(
    page.getByLabel("Clinic optimization").locator("article"),
  ).toHaveCount(4);
  const siteSelect = page.getByLabel("Assigned site for MC-001");
  const available = await siteSelect
    .locator("option:not(:disabled)")
    .evaluateAll((options) => options.map((o) => o.value));
  await siteSelect.selectOption(
    available.find((v) => v !== available[0]) ?? available[0],
  );
  await expect(
    page.getByLabel("Clinic optimization").locator("article"),
  ).toHaveCount(4);
  await page
    .getByRole("button", { name: "Accept local deployment draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved local approval rehearsal" }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Optimize", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Saved snapshot: 4 clinics",
  );
  await page.getByLabel("Find municipality").fill("Bay");
  await page.getByLabel("Find municipality").press("ArrowDown");
  await page.getByLabel("Find municipality").press("Enter");
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page
    .getByLabel("Flood severity", { exact: true })
    .selectOption("severe");
  await page.getByLabel("Disease outbreak surge", { exact: true }).fill("2");
  await page
    .getByRole("group", { name: "Road disruptions" })
    .getByRole("checkbox")
    .first()
    .check();
  await expect(
    page
      .getByRole("group", { name: "Road disruptions" })
      .getByRole("checkbox")
      .first(),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Play simulation", exact: true })
    .click();
  await page.waitForTimeout(300);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(page.getByLabel("Deployment timeline")).not.toHaveValue("0");
  await page.getByLabel("Deployment timeline").fill("0.5");
  await expect(page.locator(".workspace-playback output")).toHaveText("50%");
  await page.getByRole("button", { name: "Close tool panel" }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.getByLabel("Flood severity", { exact: true })).toHaveValue(
    "severe",
  );
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page
    .getByRole("button", { name: "Explain the need score", exact: true })
    .click();
  await expect(page.getByRole("log")).toContainText("Bay");
  await page.getByRole("button", { name: "Close tool panel" }).click();
  await page
    .getByRole("button", { name: /OpenStreetMap · Map settings/ })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Map settings" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await mkdir(resolve(frontend, "test-results"), { recursive: true });
  await page.screenshot({
    path: resolve(frontend, "test-results/workspace-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByLabel("Find municipality")).toBeVisible();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await page.screenshot({
    path: resolve(frontend, "test-results/workspace-map-mobile.png"),
  });
  await page.getByRole("button", { name: "Optimize", exact: true }).click();
  await expect(page.getByLabel("Clinic optimization")).toBeVisible();
  await page.screenshot({
    path: resolve(frontend, "test-results/workspace-mobile.png"),
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  if (overflow) throw new Error("Mobile layout overflows horizontally");
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    for (const button of await page
      .getByRole("navigation", { name: "Planning tools" })
      .getByRole("button")
      .all()) {
      const box = await button.boundingBox();
      if (!box || box.x < 0 || box.x + box.width > viewport.width)
        throw new Error(`Planning tools are clipped at ${viewport.width}px`);
    }
  }
  await page.goto("http://127.0.0.1:5175/simulator");
  await expect(
    page.getByLabel("Disaster simulator", { exact: true }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:5175/optimization");
  await expect(
    page.getByLabel("Clinic optimization", { exact: true }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:5175/public");
  await expect(
    page.getByRole("heading", { name: /Your next care visit/i }),
  ).toBeVisible();
  for (const removed of ["overview", "dashboard", "schedules"]) {
    await page.goto(`http://127.0.0.1:5175/${removed}`);
    await expect(
      page.getByRole("heading", { name: "Page not found", exact: true }),
    ).toBeVisible();
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Workspace browser checks passed: desktop/mobile, selection, filters, placement, approval, playback, panel reopening, assistant, public view, removed page routes, floating controls and zoom.",
  );
} finally {
  await browser?.close();
  server.kill();
}
