import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const AGENT_CI_VERSION = "0.17.0";
export const RUNNER_IMAGE_ALIAS = "ghcr.io/actions/actions-runner:latest";
export const RUNNER_IMAGE_DIGEST = "sha256:08c30b0a7105f64bddfc485d2487a22aa03932a791402393352fdf674bda2c29";
export const RUNNER_IMAGE_REFERENCE = `ghcr.io/actions/actions-runner@${RUNNER_IMAGE_DIGEST}`;

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..");
const require = createRequire(import.meta.url);
const IMAGE_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function resolveAgentCiInstall(options = {}) {
  const resolvePackageJson = options.resolvePackageJson || (() => require.resolve("@redwoodjs/agent-ci/package.json"));
  const readFile = options.readFile || readFileSync;
  const packageJsonPath = resolvePackageJson();
  const manifest = JSON.parse(readFile(packageJsonPath, "utf8"));

  if (
    manifest.name !== "@redwoodjs/agent-ci" ||
    manifest.version !== AGENT_CI_VERSION ||
    manifest.bin?.["agent-ci"] !== "./dist/native-launcher.js"
  ) {
    throw new Error(`Expected @redwoodjs/agent-ci ${AGENT_CI_VERSION} with its reviewed launcher layout.`);
  }

  const packageRoot = dirname(packageJsonPath);
  return {
    packageRoot,
    configPath: join(packageRoot, "dist", "config.js"),
    launcherPath: join(packageRoot, manifest.bin["agent-ci"]),
  };
}

export function partitionAgentCiEnvironment(environment, options = {}) {
  const root = options.repoRoot || repoRoot;
  const mkdir = options.mkdir || ((directory) => mkdirSync(directory, { recursive: true }));
  const digestSegment = RUNNER_IMAGE_DIGEST.replace(":", "-");
  const cacheRoot = join(
    root,
    ".npm",
    "agent-ci-seed",
    `${process.platform}-${process.arch}`,
    `agent-ci-${AGENT_CI_VERSION}`,
    `runner-${digestSegment}`,
  );
  const tempDirectory = join(cacheRoot, "tmp");
  const xdgCacheDirectory = join(cacheRoot, "xdg-cache");

  mkdir(tempDirectory);
  mkdir(xdgCacheDirectory);
  environment.TMPDIR = tempDirectory;
  environment.TMP = tempDirectory;
  environment.TEMP = tempDirectory;
  environment.XDG_CACHE_HOME = xdgCacheDirectory;
  environment.AGENT_CI_FORCE_TYPESCRIPT = "1";

  return { cacheRoot, tempDirectory, xdgCacheDirectory };
}

function dockerArguments(args, environment) {
  const dockerHost = environment.AGENT_CI_DOCKER_HOST?.trim();
  return dockerHost ? ["--host", dockerHost, ...args] : args;
}

function runDocker(args, options = {}) {
  const spawn = options.spawn || spawnSync;
  const environment = options.env || process.env;
  const capture = options.capture === true;
  const result = spawn("docker", dockerArguments(args, environment), {
    encoding: capture ? "utf8" : undefined,
    env: environment,
    shell: false,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    throw new Error(`Failed to run Docker: ${result.error.message}`);
  }
  return result;
}

export function inspectImageId(reference, options = {}) {
  const result = runDocker(["image", "inspect", "--format", "{{.Id}}", reference], {
    ...options,
    capture: true,
  });
  if (result.status !== 0) {
    return null;
  }

  const imageId = String(result.stdout || "").trim();
  if (!IMAGE_ID_PATTERN.test(imageId)) {
    throw new Error(`Docker returned an invalid image ID for ${reference}.`);
  }
  return imageId;
}

function requireSuccessfulDockerCommand(args, description, options = {}) {
  const result = runDocker(args, options);
  if (result.status !== 0) {
    const suffix = result.signal ? ` (signal ${result.signal})` : ` (exit ${result.status ?? "unknown"})`;
    throw new Error(`${description} failed${suffix}.`);
  }
}

export function ensurePinnedRunnerAlias(options = {}) {
  let pinnedImageId = inspectImageId(RUNNER_IMAGE_REFERENCE, options);
  if (!pinnedImageId) {
    requireSuccessfulDockerCommand(["pull", RUNNER_IMAGE_REFERENCE], "Pulling the pinned Agent CI runner image", options);
    pinnedImageId = inspectImageId(RUNNER_IMAGE_REFERENCE, options);
  }
  if (!pinnedImageId) {
    throw new Error("The pinned Agent CI runner image is unavailable after Docker reported a successful pull.");
  }

  requireSuccessfulDockerCommand(
    ["image", "tag", RUNNER_IMAGE_REFERENCE, RUNNER_IMAGE_ALIAS],
    "Tagging the pinned Agent CI runner image",
    options,
  );
  const aliasImageId = inspectImageId(RUNNER_IMAGE_ALIAS, options);
  if (!aliasImageId || aliasImageId !== pinnedImageId) {
    throw new Error("The local Agent CI runner alias does not resolve to the reviewed image digest.");
  }

  return pinnedImageId;
}

async function importAgentCiModule(modulePath) {
  return await import(pathToFileURL(modulePath).href);
}

export function launchAgentCi(args, install, options = {}) {
  const spawn = options.spawn || spawnSync;
  const result = spawn(process.execPath, [install.launcherPath, ...args], {
    env: options.env || process.env,
    shell: false,
    stdio: "inherit",
  });
  if (result.error) {
    throw new Error(`Failed to launch Agent CI: ${result.error.message}`);
  }
  if (result.signal) {
    (options.resignal || ((signal) => process.kill(process.pid, signal)))(result.signal);
    return 1;
  }
  return result.status ?? 1;
}

export async function runAgentCi(args, options = {}) {
  const environment = options.env || process.env;
  const root = options.repoRoot || repoRoot;
  const install = (options.resolveInstall || resolveAgentCiInstall)();
  partitionAgentCiEnvironment(environment, {
    repoRoot: root,
    mkdir: options.mkdir,
  });

  const loadModule = options.loadModule || importAgentCiModule;
  const configModule = await loadModule(install.configPath);
  if (typeof configModule.applyAgentCiEnv !== "function") {
    throw new Error("The reviewed Agent CI environment loader is unavailable.");
  }
  configModule.applyAgentCiEnv(root);

  if (environment.DOCKER_HOST) {
    throw new Error("DOCKER_HOST is unsupported by Agent CI 0.17.0; use AGENT_CI_DOCKER_HOST instead.");
  }
  if (args[0] === "run") {
    (options.prepareRunner || ensurePinnedRunnerAlias)({
      env: environment,
      spawn: options.spawn,
    });
  }

  return (options.launch || launchAgentCi)(args, install, {
    env: environment,
    spawn: options.launchSpawn,
    resignal: options.resignal,
  });
}

function isEntrypoint() {
  const entryPath = process.argv[1];
  if (!entryPath) {
    return false;
  }
  try {
    return realpathSync(resolve(entryPath)) === realpathSync(scriptPath);
  } catch {
    return resolve(entryPath) === scriptPath;
  }
}

if (isEntrypoint()) {
  try {
    process.exitCode = await runAgentCi(process.argv.slice(2));
  } catch (error) {
    console.error(`[Agent CI wrapper] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
