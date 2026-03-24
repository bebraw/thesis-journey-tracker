import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import { launch as launchChrome } from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

const REPORT_DIR = resolve(process.cwd(), "reports/lighthouse");
const BASE_URL = "http://127.0.0.1:8788";
const DASHBOARD_URL = `${BASE_URL}/`;
const SERVER_READY_PATTERN = /Ready on http:\/\/(?:localhost|127\.0\.0\.1):8788/;
const SERVER_START_TIMEOUT_MS = 120_000;
const MIN_PERFORMANCE_SCORE = 90;

const auditModes = [
  { id: "mobile", config: undefined },
  { id: "desktop", config: desktopConfig },
];

await main();

async function main() {
  await mkdir(REPORT_DIR, { recursive: true });

  const credentials = await resolveLoginCredentials();
  const server = await startServer();

  try {
    const cookieHeader = await loginAndGetCookie(credentials);
    const chromePath = chromium.executablePath();
    const results = [];

    for (const mode of auditModes) {
      const result = await runAudit({
        mode,
        cookieHeader,
        chromePath,
      });
      results.push(result);
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      url: DASHBOARD_URL,
      modes: results,
    };

    await writeFile(resolve(REPORT_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

    printSummary(results);
    assertBudgets(results);
  } finally {
    await stopServer(server);
  }
}

async function resolveLoginCredentials() {
  const appUsersJson =
    (await readEnvValue(resolve(process.cwd(), "tests/e2e/.env.e2e"), "APP_USERS_JSON")) ??
    (await readEnvValue(resolve(process.cwd(), ".dev.vars"), "APP_USERS_JSON"));
  const editorUser = readEditorUser(appUsersJson);

  return {
    name: editorUser?.name ?? "Advisor",
    password:
      editorUser?.password ??
      (await readEnvValue(resolve(process.cwd(), "tests/e2e/.env.e2e"), "APP_PASSWORD")) ??
      (await readEnvValue(resolve(process.cwd(), ".dev.vars"), "APP_PASSWORD")) ??
      "e2e-password",
  };
}

function readEditorUser(appUsersJson) {
  if (!appUsersJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(appUsersJson);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const editorUser = parsed.find(
      (user) => user?.role === "editor" && typeof user.password === "string" && typeof user.name === "string",
    );
    return editorUser ? { name: editorUser.name, password: editorUser.password } : null;
  } catch {
    return null;
  }
}

async function readEnvValue(filePath, key) {
  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, "utf8");
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : null;
}

function startServer() {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = spawn("npm", ["run", "e2e:server"], {
      cwd: process.cwd(),
      detached: process.platform !== "win32",
      env: { ...process.env, CI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      terminateServer(server, "SIGTERM");
      rejectPromise(new Error("Timed out waiting for Lighthouse test server."));
    }, SERVER_START_TIMEOUT_MS);

    const handleChunk = (chunk, writer) => {
      const text = chunk.toString();
      writer(`[lighthouse-server] ${text}`);
      if (!settled && SERVER_READY_PATTERN.test(text)) {
        settled = true;
        clearTimeout(timeout);
        resolvePromise(server);
      }
    };

    server.stdout.on("data", (chunk) => handleChunk(chunk, process.stdout.write.bind(process.stdout)));
    server.stderr.on("data", (chunk) => handleChunk(chunk, process.stderr.write.bind(process.stderr)));

    server.on("exit", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      rejectPromise(new Error(`Lighthouse test server exited before ready (code ${code}).`));
    });

    server.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      rejectPromise(error);
    });
  });
}

async function stopServer(server) {
  if (server.exitCode !== null) {
    return;
  }

  terminateServer(server, "SIGTERM");

  await Promise.race([
    new Promise((resolvePromise) => server.once("exit", resolvePromise)),
    new Promise((resolvePromise) =>
      setTimeout(() => {
        if (server.exitCode === null) {
          terminateServer(server, "SIGKILL");
        }
        resolvePromise();
      }, 5_000),
    ),
  ]);
}

function terminateServer(server, signal) {
  if (process.platform !== "win32" && typeof server.pid === "number") {
    try {
      process.kill(-server.pid, signal);
      return;
    } catch {
      // Fall back to the direct child if the process group is already gone.
    }
  }

  server.kill(signal);
}

async function loginAndGetCookie(credentials) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(DASHBOARD_URL);
    const nameField = page.getByLabel("Name");
    if ((await nameField.count()) > 0) {
      await nameField.fill(credentials.name);
    }
    await page.getByLabel("Password").fill(credentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(DASHBOARD_URL, { timeout: 15_000 });

    const cookies = await context.cookies(BASE_URL);
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

    if (!cookieHeader) {
      throw new Error("Failed to obtain authenticated session cookie.");
    }

    return cookieHeader;
  } finally {
    await browser.close();
  }
}

async function runAudit({ mode, cookieHeader, chromePath }) {
  const chrome = await launchChrome({
    chromePath,
    chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox"],
  });

  try {
    const runnerResult = await lighthouse(
      DASHBOARD_URL,
      {
        port: chrome.port,
        logLevel: "error",
        output: ["html", "json"],
        onlyCategories: ["performance"],
        extraHeaders: {
          Cookie: cookieHeader,
        },
      },
      mode.config,
    );

    if (!runnerResult?.lhr || !runnerResult.report) {
      throw new Error(`Lighthouse did not produce a report for ${mode.id}.`);
    }

    const reports = Array.isArray(runnerResult.report) ? runnerResult.report : [runnerResult.report];
    const [htmlReport, jsonReport] = reports;

    await writeFile(resolve(REPORT_DIR, `${mode.id}.html`), htmlReport, "utf8");
    await writeFile(resolve(REPORT_DIR, `${mode.id}.json`), jsonReport, "utf8");

    return summarizeMode(mode.id, runnerResult.lhr);
  } finally {
    await chrome.kill();
  }
}

function summarizeMode(modeId, lhr) {
  return {
    mode: modeId,
    performanceScore: percentage(lhr.categories.performance?.score),
    firstContentfulPaintMs: numericAudit(lhr, "first-contentful-paint"),
    largestContentfulPaintMs: numericAudit(lhr, "largest-contentful-paint"),
    speedIndexMs: numericAudit(lhr, "speed-index"),
    totalBlockingTimeMs: numericAudit(lhr, "total-blocking-time"),
    cumulativeLayoutShift: numericAudit(lhr, "cumulative-layout-shift"),
    interactionToNextPaintMs: numericAudit(lhr, "interaction-to-next-paint"),
    transferSizeBytes: numericAudit(lhr, "total-byte-weight"),
    renderBlockingSavingsMs: renderBlockingSavingsMs(lhr),
    unusedCssSavingsBytes: bytesSaved(lhr, "unused-css-rules"),
    unusedJavascriptSavingsBytes: bytesSaved(lhr, "unused-javascript"),
  };
}

function numericAudit(lhr, auditId) {
  const value = lhr.audits[auditId]?.numericValue;
  return typeof value === "number" ? Math.round(value) : null;
}

function renderBlockingSavingsMs(lhr) {
  const value = lhr.audits["render-blocking-resources"]?.details?.overallSavingsMs;
  return typeof value === "number" ? Math.round(value) : null;
}

function bytesSaved(lhr, auditId) {
  const items = lhr.audits[auditId]?.details?.items;
  if (!Array.isArray(items)) {
    return null;
  }

  const total = items.reduce((sum, item) => {
    const current = item?.wastedBytes;
    return typeof current === "number" ? sum + current : sum;
  }, 0);

  return total > 0 ? Math.round(total) : null;
}

function percentage(score) {
  return typeof score === "number" ? Math.round(score * 100) : null;
}

function printSummary(results) {
  console.log("\nLighthouse performance summary");
  console.table(
    results.map((result) => ({
      mode: result.mode,
      score: result.performanceScore,
      fcpMs: result.firstContentfulPaintMs,
      lcpMs: result.largestContentfulPaintMs,
      speedIndexMs: result.speedIndexMs,
      tbtMs: result.totalBlockingTimeMs,
      cls: result.cumulativeLayoutShift,
      inpMs: result.interactionToNextPaintMs,
      bytes: result.transferSizeBytes,
    })),
  );
  console.log(`Detailed reports written to ${REPORT_DIR}`);
}

function assertBudgets(results) {
  const failures = results.filter(
    (result) => typeof result.performanceScore === "number" && result.performanceScore < MIN_PERFORMANCE_SCORE,
  );

  if (failures.length === 0) {
    return;
  }

  const details = failures
    .map((result) => `${result.mode} performance score ${result.performanceScore} is below ${MIN_PERFORMANCE_SCORE}`)
    .join("; ");

  throw new Error(`Lighthouse budget failed: ${details}`);
}
