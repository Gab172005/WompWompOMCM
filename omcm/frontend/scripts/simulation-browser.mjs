import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const frontend = fileURLToPath(new URL("..", import.meta.url));
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5178",
    "--strictPort",
  ],
  {
    cwd: frontend,
    env: {
      ...process.env,
      NODE_DISABLE_COMPILE_CACHE: "1",
      VITE_DEMO_MODE: "true",
    },
    stdio: "inherit",
  },
);
let browser;
try {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error("Vite server exited.");
    try {
      if ((await fetch("http://127.0.0.1:5178")).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({
    headless: true,
    channel: process.env.OMCM_BROWSER_CHANNEL || "chrome",
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("http://127.0.0.1:5178", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await expect(page.locator(".barangay-boundary")).toHaveCount(681, {
    timeout: 90000,
  });
  await page
    .getByRole("button", { name: "Admin View", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Fill demo credentials", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sign in to Admin View", exact: true })
    .click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  const panel = page.getByRole("complementary", {
    name: "Healthcare simulation",
    exact: true,
  });
  await expect(panel).toBeVisible();
  await panel.getByLabel("Simulation scenario").selectOption("optimizer");
  await panel
    .getByRole("button", {
      name: "Get Optimal Locations for Next Week",
      exact: true,
    })
    .click();
  await expect(
    panel.getByRole("heading", {
      name: "3 recommended locations",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const { useForecastStore } =
        await import("/src/store/useForecastStore.ts");
      return useForecastStore.getState().runs.optimizer.snapshots[0].allocation
        .length;
    }),
  ).toBe(0);
  await panel.getByLabel("Available mobile clinics (k)").fill("5");
  await expect(
    panel.getByRole("heading", {
      name: "5 recommended locations",
      exact: true,
    }),
  ).toBeVisible();
  await expect(panel.getByLabel("MC-5 barangay")).toBeVisible();
  await panel
    .getByRole("button", { name: "Reject recommendations", exact: true })
    .click();
  await expect(
    panel.getByRole("heading", {
      name: "5 recommended locations",
      exact: true,
    }),
  ).toHaveCount(0);
  await panel
    .getByRole("button", {
      name: "Get Optimal Locations for Next Week",
      exact: true,
    })
    .click();
  await panel
    .getByRole("button", { name: "Apply Recommended Allocation", exact: true })
    .click();
  const confirmed = await page.evaluate(async () => {
    const { useForecastStore } = await import("/src/store/useForecastStore.ts");
    const s = useForecastStore.getState();
    return {
      optimized: s.runs.optimizer.snapshots[0].allocation,
      manual: s.runs.manual.snapshots[0].allocation,
    };
  });
  expect(confirmed.optimized).toHaveLength(5);
  expect(new Set(confirmed.optimized.map((a) => a.psgc)).size).toBe(5);
  expect(confirmed.manual).toHaveLength(0);
  await panel.getByLabel("Simulation heatmap").selectOption("uhni");
  await expect(page.getByLabel("Map legend")).toContainText(
    "Unmet healthcare need (UHNI)",
  );
  for (let day = 2; day <= 8; day++)
    await page.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(
    panel.getByRole("heading", {
      name: "Day 8 · Week 2 · Days 8–14",
      exact: true,
    }),
  ).toBeVisible();
  await panel
    .getByRole("button", {
      name: "Get Optimal Locations for Next Week",
      exact: true,
    })
    .click();
  await panel
    .getByRole("button", { name: "Apply Recommended Allocation", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "30-day simulation timeline", exact: true })
    .fill("1");
  await expect(
    panel.getByRole("button", {
      name: "Get Optimal Locations for Next Week",
      exact: true,
    }),
  ).toBeDisabled();
  await panel.getByLabel("Simulation scenario").selectOption("manual");
  for (let i = 0; i < 5; i++)
    await panel
      .getByLabel(`MC-${i + 1} barangay`, { exact: true })
      .selectOption(confirmed.optimized[i].psgc);
  await panel
    .getByRole("button", { name: "Apply Manual Allocation", exact: true })
    .click();
  await panel.getByLabel("Simulation scenario").selectOption("none");
  await page
    .getByRole("button", { name: "Play simulation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause simulation", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  while (
    await page.evaluate(async () => {
      const { useForecastStore } =
        await import("/src/store/useForecastStore.ts");
      return useForecastStore.getState().runs.none.day < 30;
    })
  )
    await page.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(
    panel.getByRole("heading", {
      name: "Day 30 · Week 4 · Days 22–30",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next day", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeVisible();
  const playback = page.getByRole("region", {
    name: "Simulation playback",
    exact: true,
  });
  const timelineBox = await page
    .getByRole("slider", { name: "30-day simulation timeline", exact: true })
    .boundingBox();
  expect(timelineBox.width).toBeGreaterThan(200);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const panelBox = await panel.boundingBox();
  const legendBox = await page.getByLabel("Map legend").boundingBox();
  const playbackBox = await playback.boundingBox();
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(playbackBox.y);
  expect(playbackBox.y + playbackBox.height).toBeLessThanOrEqual(legendBox.y);
  await expect(playback).toBeVisible();
  await page.screenshot({ path: "/tmp/omcm-simulation-mobile.png" });
  expect(errors).toEqual([]);
  console.log(
    "Simulation browser checks passed: 681 polygons, configurable k, explicit confirmation/rejection, independent scenarios, weekly decisions, replay protection, heatmaps, daily playback, Day 30, mobile layout.",
  );
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    console.log(
      await page.evaluate(async () => {
        const { useForecastStore } =
          await import("/src/store/useForecastStore.ts");
        const s = useForecastStore.getState();
        return { day: s.runs[s.strategy].day, strategy: s.strategy };
      }),
    );
    await page.screenshot({ path: "/tmp/omcm-simulation-browser-failure.png" });
  }
  throw error;
} finally {
  await browser?.close();
  server.kill();
}
