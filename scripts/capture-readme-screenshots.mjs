import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:8788";
const OUTPUT_DIR = path.resolve("docs/screenshots");
const LOGIN_NAME = "Advisor";
const LOGIN_PASSWORD = "e2e-password";

async function login(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  const passwordField = page.getByLabel("Password");
  if ((await passwordField.count()) > 0) {
    await page.getByLabel("Name").fill(LOGIN_NAME);
    await passwordField.fill(LOGIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${BASE_URL}/`);
    await page.waitForLoadState("networkidle");
  }
}

async function showStudentPanel(page, studentName) {
  const panelShell = page.locator("#selectedStudentPanelShell");
  await page.locator("#studentSearch").fill(studentName);
  await page.locator("[data-student-row]", { hasText: studentName }).first().click();
  if (!(await panelShell.isVisible())) {
    await page.getByRole("button", { name: "Show editing panel" }).click();
  }
  await page.locator("#studentSearch").fill("");
  await page.waitForLoadState("networkidle");
}

async function addScreenshotPadding(page, options = {}) {
  const { limitStudentRows = false } = options;
  await page.addStyleTag({
    content: `
      body { background: #f3efe6 !important; }
      #selectedStudentPanelShell { display: block !important; }
      ${limitStudentRows ? "[data-student-row]:nth-of-type(n+7) { display: none !important; }" : ""}
    `,
  });
}

async function screenshotViewport(page, outputPath) {
  await page.screenshot({ path: outputPath });
}

async function captureDashboard(page) {
  await login(page);
  await showStudentPanel(page, "Aino Lehtinen");
  await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Meeting Log History" }).click();
  await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Phase Change Audit" }).click();
  await addScreenshotPadding(page, { limitStudentRows: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await screenshotViewport(page, path.join(OUTPUT_DIR, "dashboard-overview.png"));
}

async function captureStudentPanel(page) {
  await login(page);
  await showStudentPanel(page, "Aino Lehtinen");
  await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Edit Student" }).click();
  await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Meeting Log History" }).click();
  await page.locator("#selectedStudentPanel").locator("summary", { hasText: "Phase Change Audit" }).click();
  await addScreenshotPadding(page);
  await page.locator("#selectedStudentPanel").screenshot({
    path: path.join(OUTPUT_DIR, "student-panel.png"),
  });
}

async function captureDataTools(page) {
  await login(page);
  await page.goto(`${BASE_URL}/data-tools`, { waitUntil: "networkidle" });
  const exportHeading = page.getByRole("heading", { name: "Export backup" });
  const exportHeadingBox = await exportHeading.boundingBox();
  if (exportHeadingBox) {
    await page.evaluate((y) => window.scrollTo(0, Math.max(y - 120, 0)), exportHeadingBox.y);
  }
  await addScreenshotPadding(page);
  await screenshotViewport(page, path.join(OUTPUT_DIR, "data-tools.png"));
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const capture of [captureDashboard, captureStudentPanel, captureDataTools]) {
      const context = await browser.newContext({
        viewport: { width: 1600, height: 1200 },
        colorScheme: "light",
      });
      const page = await context.newPage();
      await capture(page);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

await main();
