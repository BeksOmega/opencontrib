/**
 * Unit tests for the src/docker module.
 *
 * All docker CLI calls are stubbed via jest.mock on child_process.execFile so
 * that no real Docker daemon is required.
 *
 * NOTE: setupNetwork() and verifyNetworkRules() are NOT unit-tested here —
 * they require root / CAP_NET_ADMIN and a real Docker daemon. Integration
 * testing of those functions requires a privileged environment.
 */

import { execFile } from "child_process";

jest.mock("child_process", () => ({
  execFile: jest.fn(),
}));

const mockExecFile = execFile as jest.MockedFunction<typeof execFile>;

/**
 * Helper: make execFile call its callback with the given stdout/stderr.
 * Signature: execFile(file, args, callback).
 */
function mockSuccess(stdout = "", stderr = ""): void {
  mockExecFile.mockImplementation(
    (_file: unknown, _args: unknown, callback: unknown) => {
      (callback as (err: null, stdout: string, stderr: string) => void)(
        null,
        stdout,
        stderr
      );
      return {} as ReturnType<typeof execFile>;
    }
  );
}

/**
 * Helper: make execFile call its callback with an error (non-zero exit).
 */
function mockFailure(stderr = "error output", code = 1): void {
  mockExecFile.mockImplementation(
    (_file: unknown, _args: unknown, callback: unknown) => {
      const err = Object.assign(new Error(stderr), { code, stderr });
      (callback as (err: Error) => void)(err);
      return {} as ReturnType<typeof execFile>;
    }
  );
}

/** Captures the args array passed to execFile on the most recent call. */
function capturedArgs(): string[] {
  const calls = mockExecFile.mock.calls;
  const last = calls[calls.length - 1];
  return last[1] as string[];
}

// ---------------------------------------------------------------------------
// Import modules after mock is set up
// ---------------------------------------------------------------------------

import {
  createVolume,
  deleteVolume,
  volumeExists,
  workspaceVolumeName,
  memoryVolumeName,
} from "../volumes";
import { languageToImage } from "../images";
import { runContainer, stopContainer } from "../containers";
import { DockerError } from "../exec";

// ---------------------------------------------------------------------------
// Volume tests
// ---------------------------------------------------------------------------

describe("volumes", () => {
  beforeEach(() => jest.clearAllMocks());

  test("workspaceVolumeName returns correct name", () => {
    expect(workspaceVolumeName("octocat", "hello-world")).toBe(
      "opencontrib-octocat-hello-world"
    );
  });

  test("memoryVolumeName returns correct name", () => {
    expect(memoryVolumeName("octocat", "hello-world")).toBe(
      "opencontrib-mem-octocat-hello-world"
    );
  });

  test("createVolume calls docker volume create <name>", async () => {
    mockSuccess();
    await createVolume("my-volume");
    expect(capturedArgs()).toEqual(["volume", "create", "my-volume"]);
  });

  test("deleteVolume calls docker volume rm <name>", async () => {
    mockSuccess();
    await deleteVolume("my-volume");
    expect(capturedArgs()).toEqual(["volume", "rm", "my-volume"]);
  });

  test("volumeExists returns true when docker volume inspect succeeds", async () => {
    mockSuccess("{}");
    const result = await volumeExists("my-volume");
    expect(result).toBe(true);
    expect(capturedArgs()).toEqual(["volume", "inspect", "my-volume"]);
  });

  test("volumeExists returns false when docker volume inspect exits non-zero", async () => {
    mockFailure("No such volume: my-volume");
    const result = await volumeExists("my-volume");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Image tests
// ---------------------------------------------------------------------------

describe("languageToImage", () => {
  test.each([
    ["typescript", "opencontrib-js-image"],
    ["javascript", "opencontrib-js-image"],
    ["python", "opencontrib-py-image"],
    ["rust", "opencontrib-rs-image"],
    ["go", "opencontrib-go-image"],
  ])("maps %s → %s", (lang, expected) => {
    expect(languageToImage(lang)).toBe(expected);
  });

  test("falls back to js-image for unknown languages", () => {
    expect(languageToImage("cobol")).toBe("opencontrib-js-image");
    expect(languageToImage("")).toBe("opencontrib-js-image");
  });
});

// ---------------------------------------------------------------------------
// Container tests
// ---------------------------------------------------------------------------

describe("runContainer", () => {
  beforeEach(() => jest.clearAllMocks());

  test("builds correct docker run args for an agent container", async () => {
    mockSuccess("agent output");

    await runContainer({
      image: "opencontrib-js-image",
      volumeMounts: [
        { volumeName: "opencontrib-octocat-hello-world", mountPath: "/workspace" },
        { volumeName: "opencontrib-mem-octocat-hello-world", mountPath: "/root/.claude" },
      ],
      network: "opencontrib-net",
      memoryLimit: "2g",
      cpuLimit: "1.5",
      noNewPrivileges: true,
      command: ["claude", "-p", "Fix issue #1"],
    });

    const args = capturedArgs();

    // Must include --rm
    expect(args).toContain("--rm");
    // Memory limit
    expect(args).toContain("--memory=2g");
    // CPU limit
    expect(args).toContain("--cpus=1.5");
    // No new privileges
    expect(args).toContain("--no-new-privileges");
    // Network
    expect(args).toContain("--network=opencontrib-net");
    // Volume mounts (docker -v syntax)
    expect(args).toContain("opencontrib-octocat-hello-world:/workspace");
    expect(args).toContain("opencontrib-mem-octocat-hello-world:/root/.claude");
    // Image
    expect(args).toContain("opencontrib-js-image");
    // Command
    expect(args).toContain("claude");
    expect(args).toContain("-p");
    expect(args).toContain("Fix issue #1");
  });

  test("includes env vars when provided", async () => {
    mockSuccess();

    await runContainer({
      image: "opencontrib-js-image",
      volumeMounts: [],
      network: "opencontrib-net",
      memoryLimit: "2g",
      cpuLimit: "1.5",
      noNewPrivileges: true,
      env: { MY_VAR: "hello" },
      command: ["true"],
    });

    const args = capturedArgs();
    expect(args).toContain("-e");
    expect(args).toContain("MY_VAR=hello");
  });

  test("returns exitCode 0 and stdout on success", async () => {
    mockSuccess("some output");

    const result = await runContainer({
      image: "opencontrib-js-image",
      volumeMounts: [],
      network: "opencontrib-net",
      memoryLimit: "2g",
      cpuLimit: "1.5",
      noNewPrivileges: true,
      command: ["true"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("some output");
  });
});

describe("stopContainer", () => {
  beforeEach(() => jest.clearAllMocks());

  test("calls docker stop <id>", async () => {
    mockSuccess();
    await stopContainer("abc123");
    expect(capturedArgs()).toEqual(["stop", "abc123"]);
  });
});

// ---------------------------------------------------------------------------
// DockerError tests
// ---------------------------------------------------------------------------

describe("DockerError", () => {
  beforeEach(() => jest.clearAllMocks());

  test("is thrown with stderr on non-zero docker exit", async () => {
    mockFailure("No such volume", 1);

    await expect(deleteVolume("does-not-exist")).rejects.toBeInstanceOf(DockerError);
  });

  test("DockerError message includes stderr", async () => {
    mockFailure("volume not found", 1);

    let caught: unknown;
    try {
      await deleteVolume("does-not-exist");
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(DockerError);
    expect((caught as DockerError).message).toContain("volume not found");
  });
});
