import { pbkdf2Sync, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const DEFAULT_DATABASE_NAME = "thesis_tracker_db";
const DEFAULT_ITERATIONS = 100_000;
const MAX_SUPPORTED_ITERATIONS = 100_000;

main();

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.name || !args.password || !args.role) {
    printUsage(args.help ? 0 : 1);
    return;
  }

  if (!["editor", "readonly"].includes(args.role)) {
    console.error('Role must be either "editor" or "readonly".');
    process.exit(1);
  }

  if (args.local && args.remote) {
    console.error("Choose either --local or --remote, not both.");
    process.exit(1);
  }

  const iterations = args.iterations ?? DEFAULT_ITERATIONS;
  if (!Number.isFinite(iterations) || iterations <= 0) {
    console.error("Iterations must be a positive integer.");
    process.exit(1);
  }
  if (iterations > MAX_SUPPORTED_ITERATIONS) {
    console.error(
      `Iterations above ${MAX_SUPPORTED_ITERATIONS} are not supported by the Cloudflare Workers runtime used for password verification.`,
    );
    process.exit(1);
  }

  const passwordHash = createPasswordHash(args.password, iterations);
  const sql = buildUpsertSql({
    name: args.name.trim(),
    passwordHash,
    role: args.role,
  });

  if (args.printSql) {
    process.stdout.write(`${sql}\n`);
  }

  if (args.printSql && !args.local && !args.remote) {
    return;
  }

  const wranglerArgs = ["wrangler", "d1", "execute", args.database ?? DEFAULT_DATABASE_NAME];
  if (args.remote) {
    wranglerArgs.push("--remote");
  } else {
    wranglerArgs.push("--local");
  }
  if (args.persistTo) {
    wranglerArgs.push("--persist-to", args.persistTo);
  }
  if (args.envFile) {
    wranglerArgs.push("--env-file", args.envFile);
  }
  wranglerArgs.push("--command", sql);

  const result = spawnSync("npx", wranglerArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function createPasswordHash(password, iterations) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return `pbkdf2_sha256$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function buildUpsertSql(user) {
  return `INSERT INTO app_users (name, password_hash, role)
VALUES ('${escapeSql(user.name)}', '${escapeSql(user.passwordHash)}', '${escapeSql(user.role)}')
ON CONFLICT(name) DO UPDATE SET
  password_hash = excluded.password_hash,
  role = excluded.role;`;
}

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      args.help = true;
      continue;
    }
    if (arg === "--local") {
      args.local = true;
      continue;
    }
    if (arg === "--remote") {
      args.remote = true;
      continue;
    }
    if (arg === "--print-sql") {
      args.printSql = true;
      continue;
    }
    if (arg === "--name") {
      args.name = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--password") {
      args.password = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--role") {
      args.role = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--database") {
      args.database = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--persist-to") {
      args.persistTo = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--env-file") {
      args.envFile = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--iterations") {
      args.iterations = Number.parseInt(argv[index + 1] || "", 10);
      index += 1;
      continue;
    }

    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }

  return args;
}

function printUsage(exitCode) {
  const output = exitCode === 0 ? console.log : console.error;
  output(`Usage:
  npm run account:create -- --name "Advisor" --password "change-me" --role editor
  npm run account:create -- --name "Professor" --password "change-me" --role readonly --remote
  npm run account:create -- --name "Advisor" --password "change-me" --role editor --print-sql

Options:
  --name        Account display name
  --password    Plain-text password to hash before storing
  --role        editor or readonly
  --remote      Write to the remote D1 database instead of local
  --print-sql   Print the generated SQL in addition to executing it
  --iterations  PBKDF2 iteration count (default 100000, max 100000 on Cloudflare Workers)`);
  process.exit(exitCode);
}
