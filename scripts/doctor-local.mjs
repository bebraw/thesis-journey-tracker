import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DATABASE_NAME = "thesis_tracker_db";
const MINIMUM_SECRET_BYTES = 32;
const REQUIRED_TABLES = [
  "students",
  "meeting_logs",
  "student_phase_audit",
  "app_users",
  "login_attempts",
  "app_secrets",
];

main();

function main() {
  let hasError = false;

  printSection("Environment");
  hasError = checkNodeVersion() || hasError;
  hasError = checkDevVars() || hasError;
  hasError = checkWranglerConfig() || hasError;

  printSection("Local D1");
  hasError = checkLocalDatabase() || hasError;

  if (hasError) {
    console.error("\nLocal setup has issues. Fix the items above, then rerun npm run doctor:local.");
    process.exit(1);
  }

  console.log("\nLocal setup checks passed. Start the app with npm run dev.");
}

function printSection(label) {
  console.log(`\n${label}`);
  console.log("-".repeat(label.length));
}

function checkNodeVersion() {
  const major = Number.parseInt(process.versions.node.split(".")[0] || "", 10);
  if (Number.isFinite(major) && major >= 25) {
    console.log(`ok Node.js ${process.versions.node}`);
    return false;
  }

  console.error(`error Node.js ${process.versions.node} is active. Use the version from .nvmrc before installing dependencies.`);
  return true;
}

function checkDevVars() {
  if (!existsSync(".dev.vars")) {
    console.error("error .dev.vars is missing. Create it from .dev.vars.example and set SESSION_SECRET.");
    return true;
  }

  const values = parseEnvFile(readFileSync(".dev.vars", "utf8"));
  const sessionSecretError = validateSecret("SESSION_SECRET", values.SESSION_SECRET);
  const appEncryptionSecretError = validateSecret("APP_ENCRYPTION_SECRET", values.APP_ENCRYPTION_SECRET);
  if (sessionSecretError || appEncryptionSecretError) {
    console.error(`error ${sessionSecretError || appEncryptionSecretError}`);
    return true;
  }
  if (values.SESSION_SECRET === values.APP_ENCRYPTION_SECRET) {
    console.error("error APP_ENCRYPTION_SECRET must be different from SESSION_SECRET.");
    return true;
  }

  console.log("ok .dev.vars contains strong, independent application secrets");
  return false;
}

function validateSecret(name, value) {
  if (!value) {
    return `${name} must be configured.`;
  }
  if (/^(change-this-|replace-with-)/i.test(value)) {
    return `${name} must not use a documented placeholder value.`;
  }
  if (Buffer.byteLength(value, "utf8") < MINIMUM_SECRET_BYTES) {
    return `${name} must contain at least ${MINIMUM_SECRET_BYTES} bytes.`;
  }
  return null;
}

function checkWranglerConfig() {
  if (!existsSync("wrangler.toml")) {
    console.error("error wrangler.toml is missing.");
    return true;
  }

  const config = readFileSync("wrangler.toml", "utf8");
  if (!config.includes('binding = "DB"')) {
    console.error('error wrangler.toml is missing the D1 binding named "DB".');
    return true;
  }
  if (!/database_id\s*=\s*"[^"]+"/.test(config)) {
    console.error("error wrangler.toml is missing a D1 database_id.");
    return true;
  }

  console.log("ok wrangler.toml has the DB binding");
  return false;
}

function checkLocalDatabase() {
  const tableRows = runWranglerJson([
    "d1",
    "execute",
    DATABASE_NAME,
    "--local",
    "--json",
    "--command",
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;",
  ]);

  if (!tableRows.ok) {
    console.error("error Could not inspect the local D1 database.");
    console.error(indent(tableRows.output.trim() || "Wrangler did not return diagnostic output."));
    console.error("Run npm run db:migrate, then rerun npm run doctor:local.");
    return true;
  }

  const tableNames = new Set(tableRows.rows.map((row) => row.name));
  const missingTables = REQUIRED_TABLES.filter((tableName) => !tableNames.has(tableName));
  if (missingTables.length > 0) {
    console.error(`error Local D1 is missing tables: ${missingTables.join(", ")}`);
    console.error("Run npm run db:migrate, then rerun npm run doctor:local.");
    return true;
  }
  console.log("ok local D1 schema is present");

  const userRows = runWranglerJson([
    "d1",
    "execute",
    DATABASE_NAME,
    "--local",
    "--json",
    "--command",
    "SELECT COUNT(*) AS count FROM app_users;",
  ]);

  if (!userRows.ok) {
    console.error("error Could not inspect app_users.");
    console.error(indent(userRows.output.trim() || "Wrangler did not return diagnostic output."));
    return true;
  }

  const count = Number(userRows.rows[0]?.count || 0);
  if (count <= 0) {
    console.error("error No login accounts found in local D1.");
    console.error('Run npm run account:create -- --name "Advisor" --password "change-this-password" --role editor');
    return true;
  }

  console.log(`ok local D1 has ${count} login account${count === 1 ? "" : "s"}`);
  return false;
}

function runWranglerJson(args) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, ["wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;

  if (result.status !== 0) {
    return { ok: false, output, rows: [] };
  }

  try {
    const payload = JSON.parse(result.stdout || "[]");
    const rows = Array.isArray(payload)
      ? payload.flatMap((entry) => entry?.results || [])
      : Array.isArray(payload?.results)
        ? payload.results
        : [];
    return { ok: true, output, rows };
  } catch (error) {
    return { ok: false, output: `${output}\nFailed to parse Wrangler JSON: ${error.message}`, rows: [] };
  }
}

function parseEnvFile(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }
  return values;
}

function indent(value) {
  return value
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join("\n");
}
