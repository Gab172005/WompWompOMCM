import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("..", import.meta.url));
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5183",
    "--strictPort",
  ],
  {
    cwd: frontend,
    env: {
      ...process.env,
      VITE_DEMO_MODE: "true",
      VITE_GOOGLE_MAPS_API_KEY: "",
    },
    stdio: "inherit",
  },
);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null)
      throw new Error("Vite exited before assistant verification.");
    try {
      if ((await fetch("http://127.0.0.1:5183")).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Vite did not start.");
  browser = await chromium.launch({
    channel: process.env.OMCM_BROWSER_CHANNEL || "chrome",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  let providerRequests = 0;
  await page.route("**/api/assistant", async (route) => {
    providerRequests++;
    const body = route.request().postDataJSON();
    const question = [...body.contents]
      .reverse()
      .flatMap((c) =>
        c.role === "user"
          ? c.parts.filter((p) => p.text).map((p) => p.text)
          : [],
      )[0];
    const parts =
      question === "Bring up the simulator screen"
        ? [
            {
              functionCall: { name: "navigate", args: { page: "simulation" } },
              thoughtSignature: "browser-fixture-signature",
            },
          ]
        : [
            {
              text: "These tools help compare clinic plans and explain the tradeoffs.",
            },
          ];
    await route.fulfill({
      json: {
        content: { role: "model", parts },
        provider: "gemini",
        model: "gemini-3.8-flash",
      },
    });
  });
  await page.goto("http://127.0.0.1:5183", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".barangay-boundary")).toHaveCount(681);
  await page
    .getByRole("button", { name: "Admin View", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Use demo sign-in details" }).click();
  await page.getByRole("button", { name: "Sign in to Admin View" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const workspaceUrl = page.url();
  await page
    .getByRole("button", { name: "Planning help", exact: true })
    .click();
  const widget = page.getByRole("region", {
    name: "OMCM assistant",
    exact: true,
  });
  await expect(widget).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(widget).toHaveCSS("opacity", "1");
  const log = widget.getByRole("log", { name: "Planning conversation" });
  const { nearest, score } = await page.evaluate(async () => {
    const data = await import("/src/services/providedData.ts");
    const laguna = await import("/src/services/lagunaData.ts");
    const m = laguna
      .computeLagunaMunicipalities({
        floodOverrides: {},
        morbiditySpikes: {},
        closedRoadIds: [],
      })
      .find((m) => m.name === "Los Baños");
    return {
      score: data.MUNICIPALITY_HEALTHCARE_NEED.get(m.psgc).needScore,
      nearest: [...data.MAPPED_HOSPITALS].sort(
        (a, b) => data.distanceKm(m, a) - data.distanceKm(m, b),
      )[0].name,
    };
  });
  const timings = [];

  async function ask(question) {
    await widget
      .getByRole("textbox", { name: "Assistant message" })
      .fill(question);
    const started = performance.now();
    await widget
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(log).toHaveAttribute("aria-busy", "false", { timeout: 30000 });
    timings.push({
      question,
      milliseconds: Math.round(performance.now() - started),
    });
    await expect(widget.locator(".assistant-message-error")).toHaveCount(0);
  }
  await ask("Show Los Baños and the nearest hospitals");
  await expect(log).toContainText(nearest);
  await expect(
    page.getByRole("region", { name: "Selected place" }),
  ).toContainText("Los Baños");
  await ask("Show its need score");
  await expect(log).toContainText(`${score}/100`);
  await ask("Explain the need score");
  await expect(log).toContainText("Illness rate (sample data): 35%");
  await expect(log).toContainText("same Balanced weights");
  await ask("Open clinic planning with four clinics");
  await expect(page).toHaveURL(workspaceUrl);
  await expect(
    page.getByRole("complementary", {
      name: "Plan clinic locations",
      exact: true,
    }),
  ).toBeVisible();
  await expect(log).toContainText("4 clinics");
  await ask("Open the 30-day simulation");
  await expect(page).toHaveURL(workspaceUrl);
  await expect(
    page.getByRole("complementary", { name: "Try a 30-day clinic plan" }),
  ).toBeVisible();
  await ask("Get optimizer suggestions for three clinics");
  await expect(log).toContainText("Generate optimized locations");
  await expect(
    page.getByRole("button", { name: "Generate optimized locations", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/3 optimized locations/)).toHaveCount(0);
  await ask("Show public schedules for tomorrow");
  await expect(page).toHaveURL(workspaceUrl);
  await expect(widget).toBeVisible();
  await expect(log).toContainText("Los Baños");
  expect(providerRequests, "Common commands must not wait for Gemini").toBe(0);
  expect(Math.max(...timings.map((t) => t.milliseconds))).toBeLessThan(1500);
  console.log(
    JSON.stringify({ fastCommands: timings, geminiRequests: providerRequests }),
  );
  await ask("Bring up the simulator screen");
  expect(
    providerRequests,
    "Gemini-selected screen actions need only one provider call",
  ).toBe(1);
  await expect(page).toHaveURL(workspaceUrl);
  await ask("Why are these planning tools useful?");
  expect(providerRequests).toBe(2);
  await expect(log).toContainText("explain the tradeoffs");
  const messageCount = await log.locator(".workspace-chat-message").count();
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await widget.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await widget.getByRole("button", { name: "Close assistant" }).click();
  await page.getByRole("button", { name: "Open OMCM assistant" }).click();
  await expect(log.locator(".workspace-chat-message")).toHaveCount(
    messageCount,
  );
  await mkdir(`${frontend}/test-results`, { recursive: true });
  await page.screenshot({
    path: `${frontend}/test-results/assistant-mobile.png`,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: `${frontend}/test-results/assistant-desktop.png`,
  });
  await page.unroute("**/api/assistant");
  await page.route("**/api/assistant", (route) =>
    route.fulfill({
      status: 429,
      json: { detail: "Gemini quota exceeded. Try again later." },
    }),
  );
  await widget
    .getByRole("textbox", { name: "Assistant message" })
    .fill("Explain this plan");
  await widget
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(widget.locator(".assistant-message-error")).toContainText(
    "Gemini quota exceeded",
  );
  expect(errors).toEqual([]);
  console.log(
    "Assistant browser checks passed: common commands use zero Gemini requests, model-selected actions use one request, real data lookup, selection/refocus, follow-up, planning/simulation/public navigation, editable drafts, persistent conversation, mobile layout, provider failure, no page errors. Remaining provider responses are stubbed.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
