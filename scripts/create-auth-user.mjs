import { pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { isUsernameAvailable, parseUsername, usernameDirectorySql } from "../src/auth/username.ts";

const DEFAULT_DATABASE_NAME = "thesis_tracker_db";
const PASSWORD_HASH_ITERATIONS = 100_000;
const MINIMUM_PASSWORD_CHARACTERS = 15;
const MAXIMUM_PASSWORD_BYTES = 1_024;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage(console.log);
    return 0;
  }
  const password = args.passwordStdin ? readPasswordFromStdin() : await promptForPassword();
  validatePassword(password);
  const passwordHash = createPasswordHash(password);
  let sql;
  if (args.resetPassword) {
    sql = buildPasswordResetSql(args.id, passwordHash);
  } else {
    const directory = runWrangler(args, ["--command", `SELECT ${usernameDirectorySql} AS directory`]).results[0].directory;
    sql = buildCreateSql(args, passwordHash, directory);
  }
  executeWranglerSql(sql, args);
  console.log(args.resetPassword ? `Password reset for account #${args.id}.` : "Account created.");
  return 0;
}

export function parseArgs(argv) {
  const args = { resetPassword: argv[0] === "reset-password" };
  for (let index = args.resetPassword ? 1 : 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      args.help = true;
    } else if (arg === "--local") {
      args.local = true;
    } else if (arg === "--remote") {
      args.remote = true;
    } else if (arg === "--password-stdin") {
      args.passwordStdin = true;
    } else if (["--name", "--role", "--id", "--database", "--persist-to", "--env-file"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a value.`);
      }
      const key = {
        "--name": "name",
        "--role": "role",
        "--id": "id",
        "--database": "database",
        "--persist-to": "persistTo",
        "--env-file": "envFile",
      }[arg];
      args[key] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.help) return args;
  if (args.local && args.remote) throw new Error("Choose either --local or --remote.");
  if (args.resetPassword) {
    if (args.name || args.role || !/^[1-9]\d*$/.test(args.id ?? "") || !Number.isSafeInteger(Number(args.id))) {
      throw new Error("Reset a password using --id with the verified numeric account ID. Omit --name and --role.");
    }
    args.id = Number(args.id);
  } else {
    args.name = parseUsername(args.name);
    if (!args.name || args.id) throw new Error("Create an account using --name with a single-line name of 1 to 100 characters and --role.");
    if (!["editor", "readonly"].includes(args.role)) throw new Error('Role must be either "editor" or "readonly".');
  }
  return args;
}

export function validatePassword(password) {
  if ([...password].length < MINIMUM_PASSWORD_CHARACTERS) {
    throw new Error(`Passwords must contain at least ${MINIMUM_PASSWORD_CHARACTERS} characters.`);
  }
  if (Buffer.byteLength(password, "utf8") > MAXIMUM_PASSWORD_BYTES) {
    throw new Error(`Passwords must not exceed ${MAXIMUM_PASSWORD_BYTES} UTF-8 bytes.`);
  }
  if (/[\0\r\n]/.test(password)) {
    throw new Error("Passwords must not contain NUL or newline characters.");
  }
}

export function createPasswordHash(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, 32, "sha256");
  return `pbkdf2_sha256$${PASSWORD_HASH_ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function buildCreateSql({ name, role }, passwordHash, directory) {
  if (!isUsernameAvailable(directory, name)) throw new Error("This account name is already in use.");
  // A concurrent directory change makes the required name NULL and aborts the insert.
  return `INSERT INTO app_users (name, password_hash, role)
VALUES ((SELECT '${escapeSql(name)}' WHERE ${usernameDirectorySql} = '${escapeSql(directory)}'),
  '${escapeSql(passwordHash)}', '${escapeSql(role)}') RETURNING id;`;
}

export function buildPasswordResetSql(id, passwordHash) {
  return `UPDATE app_users SET password_hash = '${escapeSql(passwordHash)}', session_version = session_version + 1
WHERE id = ${id} RETURNING id;`;
}

export function executeWranglerSql(sql, args, options = {}) {
  const temporaryRoot = mkdtempSync(join(options.tempRoot || tmpdir(), "thesis-auth-"));
  const sqlPath = join(temporaryRoot, "account.sql");
  writeFileSync(sqlPath, `${sql}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });

  try {
    const result = runWrangler(args, ["--file", sqlPath], options.spawn);
    // Remote file execution returns aggregate import metadata. Local execution returns rows.
    const changed = args.remote ? result.meta?.rows_written > 0 : result.results?.length === 1;
    if (!changed) throw new Error("No account was updated. Verify the account ID and target database.");
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

function runWrangler(args, inputArgs, spawn = spawnSync) {
  const wranglerArgs = [
    "wrangler",
    "d1",
    "execute",
    args.database || DEFAULT_DATABASE_NAME,
    args.remote ? "--remote" : "--local",
    "--json",
  ];
  if (args.persistTo) wranglerArgs.push("--persist-to", args.persistTo);
  if (args.envFile) wranglerArgs.push("--env-file", args.envFile);
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawn(command, [...wranglerArgs, ...inputArgs], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Wrangler could not execute the account operation. Check the database and retry.");
  const [statement] = JSON.parse(result.stdout);
  if (!statement?.success) throw new Error("Wrangler could not confirm the account operation.");
  return statement;
}

function readPasswordFromStdin() {
  const input = readFileSync(0, "utf8").replace(/\r?\n$/, "");
  if (/[\r\n]/.test(input)) {
    throw new Error("--password-stdin accepts exactly one password line.");
  }
  return input;
}

async function promptForPassword() {
  const password = await readHiddenLine("Password: ");
  const confirmation = await readHiddenLine("Confirm password: ");
  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }
  return password;
}

function readHiddenLine(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Interactive password entry requires a TTY. Use --password-stdin for automation.");
  }

  process.stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = "";
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const finish = (result, error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(result);
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish("", new Error("Password entry cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = [...value].slice(0, -1).join("");
        } else if (character >= " ") {
          value += character;
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

function printUsage(output) {
  output(`Usage:
  npm run account:create -- --name "Advisor" --role editor
  npm run account:create -- --name "Professor" --role readonly --remote
  npm run account:reset-password -- --id 12
  secret-manager-command | npm run account:create -- --name "Automation" --role editor --password-stdin

Options:
  --name            Account display name
  --role            editor or readonly
  --id              Verified account ID for a password reset
  --remote          Write to the remote D1 database instead of local
  --password-stdin  Read one password line from standard input for automation
  --database        Override the D1 database name
  --persist-to      Override Wrangler's local persistence directory
  --env-file        Pass an environment file to Wrangler`);
}
