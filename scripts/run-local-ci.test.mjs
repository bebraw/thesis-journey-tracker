import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LOCAL_CI_VERSION,
  ensurePinnedRunnerAlias,
  launchLocalCi,
  partitionLocalCiEnvironment,
  resolveLocalCiInstall,
  RUNNER_IMAGE_ALIAS,
  RUNNER_IMAGE_DIGEST,
  RUNNER_IMAGE_REFERENCE,
  runLocalCi,
} from "./run-local-ci.mjs";

const IMAGE_ID = `sha256:${"a".repeat(64)}`;

function dockerMock(responses) {
  const calls = [];
  const spawn = (_command, args, options) => {
    calls.push({ args, options });
    const response = responses.shift();
    if (!response) {
      throw new Error(`Unexpected Docker call: ${args.join(" ")}`);
    }
    return response;
  };
  return { calls, spawn };
}

describe("Local CI wrapper", () => {
  it("partitions temporary and working state by the reviewed package and image digest", () => {
    const environment = {};
    const directories = [];
    const paths = partitionLocalCiEnvironment(environment, {
      repoRoot: "/repo",
      mkdir: (directory) => directories.push(directory),
    });

    expect(paths.cacheRoot).toContain(`local-ci-${LOCAL_CI_VERSION}`);
    expect(paths.cacheRoot).toContain(`runner-${RUNNER_IMAGE_DIGEST.replace(":", "-")}`);
    expect(environment.TMPDIR).toBe(paths.tempDirectory);
    expect(environment.TMP).toBe(paths.tempDirectory);
    expect(environment.TEMP).toBe(paths.tempDirectory);
    expect(environment.XDG_CACHE_HOME).toBe(paths.xdgCacheDirectory);
    expect(environment.LOCAL_CI_FORCE_TYPESCRIPT).toBe("1");
    expect(paths.cacheRoot).toContain(`${process.platform}-${process.arch}`);
    expect(directories).toEqual([paths.tempDirectory, paths.xdgCacheDirectory]);
  });

  it("retags an already cached pinned image without pulling latest", () => {
    const mock = dockerMock([{ status: 0, stdout: `${IMAGE_ID}\n` }, { status: 0 }, { status: 0, stdout: `${IMAGE_ID}\n` }]);

    expect(ensurePinnedRunnerAlias({ spawn: mock.spawn, env: {} })).toBe(IMAGE_ID);
    expect(mock.calls.map(({ args }) => args)).toEqual([
      ["image", "inspect", "--format", "{{.Id}}", RUNNER_IMAGE_REFERENCE],
      ["image", "tag", RUNNER_IMAGE_REFERENCE, RUNNER_IMAGE_ALIAS],
      ["image", "inspect", "--format", "{{.Id}}", RUNNER_IMAGE_ALIAS],
    ]);
  });

  it("pulls only the immutable reference when it is missing", () => {
    const mock = dockerMock([
      { status: 1, stderr: "missing" },
      { status: 0 },
      { status: 0, stdout: `${IMAGE_ID}\n` },
      { status: 0 },
      { status: 0, stdout: `${IMAGE_ID}\n` },
    ]);

    ensurePinnedRunnerAlias({ spawn: mock.spawn, env: {} });
    expect(mock.calls.filter(({ args }) => args.includes("pull")).map(({ args }) => args)).toEqual([["pull", RUNNER_IMAGE_REFERENCE]]);
  });

  it("fails closed when the alias does not match the pinned image", () => {
    const mock = dockerMock([{ status: 0, stdout: `${IMAGE_ID}\n` }, { status: 0 }, { status: 0, stdout: `sha256:${"b".repeat(64)}\n` }]);

    expect(() => ensurePinnedRunnerAlias({ spawn: mock.spawn, env: {} })).toThrow("does not resolve to the reviewed image");
  });

  it("fails closed when Docker returns a malformed image ID", () => {
    const mock = dockerMock([{ status: 0, stdout: "untrusted-image-id\n" }]);

    expect(() => ensurePinnedRunnerAlias({ spawn: mock.spawn, env: {} })).toThrow("invalid image ID");
  });

  it("fails closed when Docker cannot tag the pinned image", () => {
    const mock = dockerMock([{ status: 0, stdout: `${IMAGE_ID}\n` }, { status: 1 }]);

    expect(() => ensurePinnedRunnerAlias({ spawn: mock.spawn, env: {} })).toThrow("Tagging the pinned Local CI runner image failed");
  });

  it("uses the Local CI Docker host override for wrapper Docker commands", () => {
    const mock = dockerMock([{ status: 0, stdout: `${IMAGE_ID}\n` }, { status: 0 }, { status: 0, stdout: `${IMAGE_ID}\n` }]);

    ensurePinnedRunnerAlias({ spawn: mock.spawn, env: { LOCAL_CI_DOCKER_HOST: "unix:///custom/docker.sock" } });
    expect(mock.calls.every(({ args }) => args.slice(0, 2).join(" ") === "--host unix:///custom/docker.sock")).toBe(true);
  });

  it("sets cache state before loading Local CI and preserves launcher exit codes", async () => {
    const environment = {};
    const loadedPaths = [];
    const install = {
      configPath: "/local-ci/config.js",
      launcherPath: "/local-ci/native-launcher.js",
    };
    let preparedDockerHost = "";
    let launchedArgs = [];

    const exitCode = await runLocalCi(["run"], {
      env: environment,
      repoRoot: "/repo",
      mkdir: () => undefined,
      resolveInstall: () => install,
      loadModule: async (modulePath) => {
        loadedPaths.push(modulePath);
        expect(environment.TMPDIR).toContain(`local-ci-${LOCAL_CI_VERSION}`);
        return {
          applyLocalCiEnv: () => {
            environment.LOCAL_CI_DOCKER_HOST = "unix:///custom/docker.sock";
          },
        };
      },
      prepareRunner: ({ env }) => {
        preparedDockerHost = env.LOCAL_CI_DOCKER_HOST;
      },
      launch: (args) => {
        launchedArgs = args;
        return 77;
      },
    });

    expect(exitCode).toBe(77);
    expect(preparedDockerHost).toBe("unix:///custom/docker.sock");
    expect(launchedArgs).toEqual(["run"]);
    expect(loadedPaths).toEqual([install.configPath]);
  });

  it("propagates the reviewed launcher child exit status", () => {
    const calls = [];
    const exitCode = launchLocalCi(
      ["run", "--quiet"],
      { launcherPath: "/local-ci/native-launcher.js" },
      {
        env: { TEST_ENV: "1" },
        spawn: (command, args, options) => {
          calls.push({ command, args, options });
          return { status: 77 };
        },
      },
    );

    expect(exitCode).toBe(77);
    expect(calls[0]?.command).toBe(process.execPath);
    expect(calls[0]?.args).toEqual(["/local-ci/native-launcher.js", "run", "--quiet"]);
    expect(calls[0]?.options.shell).toBe(false);
  });

  it("rejects the deprecated Docker host variable before launch", async () => {
    await expect(
      runLocalCi(["--help"], {
        env: { DOCKER_HOST: "unix:///deprecated.sock" },
        repoRoot: "/repo",
        mkdir: () => undefined,
        resolveInstall: () => ({ configPath: "/local-ci/config.js", launcherPath: "/local-ci/native-launcher.js" }),
        loadModule: async () => ({ applyLocalCiEnv: () => undefined }),
        launch: () => 0,
      }),
    ).rejects.toThrow("LOCAL_CI_DOCKER_HOST");
  });

  it("matches the installed reviewed Local CI package layout", async () => {
    const install = resolveLocalCiInstall();
    expect(JSON.parse(readFileSync(`${install.packageRoot}/package.json`, "utf8")).version).toBe(LOCAL_CI_VERSION);
    const configModule = await import(pathToFileURL(install.configPath).href);
    const launcherModule = await import(pathToFileURL(install.launcherPath).href);
    expect(typeof configModule.applyLocalCiEnv).toBe("function");
    expect(typeof launcherModule.runNativeOrTypeScript).toBe("function");
  });

  it("rejects an unreviewed Local CI package layout", () => {
    expect(() =>
      resolveLocalCiInstall({
        resolvePackageJson: () => "/local-ci/package.json",
        readFile: () => JSON.stringify({ name: "run-local-ci", version: "0.18.0", bin: { "local-ci": "./dist/cli.js" } }),
      }),
    ).toThrow(`Expected run-local-ci ${LOCAL_CI_VERSION}`);
  });
});
