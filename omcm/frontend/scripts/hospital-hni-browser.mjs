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
    "5177",
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
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Vite exited before browser verification.");
    try {
      if ((await fetch("http://127.0.0.1:5177")).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Vite is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Vite did not become ready within 30 seconds.");
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
  await page.goto("http://127.0.0.1:5177", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".barangay-boundary")).toHaveCount(681);
  await expect(page.locator(".hospital-marker-custom")).toHaveCount(56);
  await expect(page.getByRole("region", { name: "Map legend" })).toContainText(
    "Verified hospital",
  );

  await page
    .getByRole("button", { name: "Admin View", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Fill demo credentials" }).click();
  await page.getByRole("button", { name: "Sign in to Admin View" }).click();
  await expect(page.locator(".workspace")).toHaveClass(/is-admin-view/);
  const search = page.getByRole("combobox", {
    name: "Find municipality or barangay",
  });
  await search.fill("Pangil");
  await page.getByRole("option", { name: /^Pangil Municipality/ }).click();
  const summary = page.getByRole("region", {
    name: "Municipality healthcare need",
    exact: true,
  });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(
    "Provisional score and rank: 2 barangay scores",
  );
  const expected = await page.evaluate(async () => {
    const data = await import("/src/services/providedData.ts");
    const barangay = data.LAGUNA_BARANGAYS.find(
      (b) => b.name === "Dambo" && b.municipality === "Pangil",
    );
    const municipality = data.MUNICIPALITY_HEALTHCARE_NEED.get(
      barangay.municipalityPsgc,
    );
    return {
      barangay,
      municipality,
      scores: data.LAGUNA_BARANGAYS.map((b) => ({
        psgc: b.psgc,
        score: b.needScore,
      })),
    };
  });
  await expect(summary).toContainText(
    expected.municipality.needScore.toFixed(1),
  );
  await expect(summary).toContainText(
    `Municipality rank #${expected.municipality.needRank} of 30`,
  );
  const scoreColor = (value) =>
    value >= 70
      ? "#7f1d1d"
      : value >= 50
        ? "#b91c1c"
        : value >= 35
          ? "#ef4444"
          : value >= 20
            ? "#f87171"
            : "#fee2e2";
  const scores = new Map(expected.scores.map((b) => [b.psgc, b.score]));
  const colors = await page
    .locator(".barangay-boundary")
    .evaluateAll((paths) =>
      paths.map((path) => ({
        psgc: path.getAttribute("data-barangay-psgc"),
        fill: path.getAttribute("fill"),
      })),
    );
  for (const polygon of colors)
    expect(polygon.fill, polygon.psgc).toBe(
      scoreColor(scores.get(polygon.psgc)),
    );

  await page.getByLabel("Filter barangay ranking").fill("Dambo");
  await page.getByRole("button", { name: /^Rank \d+: Dambo, Pangil/ }).click();
  const detail = page.getByRole("region", {
    name: "Barangay healthcare need",
    exact: true,
  });
  await expect(detail).toContainText(
    `${expected.barangay.needScore.toFixed(1)} / 100`,
  );
  await expect(detail).toContainText("85% of input weight available");
  await expect(detail).toContainText(expected.barangay.nearestHospital.name);
  await expect(detail).toContainText(
    `${expected.barangay.nearestHospital.distanceKm.toFixed(2)} km straight-line distance`,
  );

  // Retained historical records are inspectable without appearing as care locations.
  await search.fill("City of Calamba");
  await page
    .getByRole("option", { name: /^City of Calamba Municipality/ })
    .click();
  await page
    .getByRole("region", { name: "Barangay healthcare need ranking" })
    .getByRole("button", { name: /^Rank \d+:/ })
    .first()
    .click();
  const register = page
    .locator("details")
    .filter({
      has: page.locator("summary", { hasText: /^Hospital register in/ }),
    });
  await register.locator("summary").click();
  await expect(register).toContainText("SAN JOSE HOSPITAL AND MEDICAL CENTER");
  await expect(register).toContainText(
    "reported closed; retained as a historical mapped hospital",
  );
  await expect(page.locator(".hospital-marker-custom")).toHaveCount(56);

  await search.fill("Pangil");
  await page.getByRole("option", { name: /^Pangil Municipality/ }).click();
  await mkdir(`${frontend}/test-results`, { recursive: true });
  await page.screenshot({
    path: `${frontend}/test-results/hospital-hni-desktop.png`,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(
    expected.municipality.needScore.toFixed(1),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${frontend}/test-results/hospital-hni-mobile.png`,
  });
  expect(errors).toEqual([]);
  console.log(
    "Step A browser checks passed: 681 polygons, 56 verified hospitals, matching HNI colors/details/rollups, provisional coverage, historical register, desktop/mobile, no page errors.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
