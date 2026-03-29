import { dockerExec } from "./exec";

export interface RunContainerOpts {
  image: string;
  volumeMounts: Array<{ volumeName: string; mountPath: string }>;
  /** "opencontrib-net" for agent containers; "bridge" for preflight containers. */
  network: string;
  /** e.g. "2g" */
  memoryLimit: string;
  /** e.g. "1.5" */
  cpuLimit: string;
  noNewPrivileges: boolean;
  env?: Record<string, string>;
  /** argv passed to the container entrypoint. */
  command: string[];
}

/**
 * Blocking run — resolves when the container exits.
 * `--rm` is always passed so Docker auto-cleans the container on exit
 * regardless of exit code.
 */
export async function runContainer(
  opts: RunContainerOpts
): Promise<{ exitCode: number; stdout: string }> {
  const args: string[] = ["run", "--rm"];

  // Resource constraints
  args.push(`--memory=${opts.memoryLimit}`);
  args.push(`--cpus=${opts.cpuLimit}`);

  if (opts.noNewPrivileges) {
    args.push("--no-new-privileges");
  }

  // Network
  args.push(`--network=${opts.network}`);

  // Volume mounts
  for (const { volumeName, mountPath } of opts.volumeMounts) {
    args.push("-v", `${volumeName}:${mountPath}`);
  }

  // Environment variables
  if (opts.env) {
    for (const [key, value] of Object.entries(opts.env)) {
      args.push("-e", `${key}=${value}`);
    }
  }

  // Image
  args.push(opts.image);

  // Command
  args.push(...opts.command);

  // execFile captures stdout; exit code is conveyed via DockerError or success.
  // For --rm containers the exit code of the inner process is returned as the
  // docker process exit code, so we parse it from the error when non-zero.
  try {
    const { stdout } = await dockerExec(args);
    return { exitCode: 0, stdout };
  } catch (err: unknown) {
    const e = err as { exitCode?: number | null; stderr?: string };
    return {
      exitCode: e.exitCode ?? 1,
      stdout: "",
    };
  }
}

/** Stops a running container by ID or name. */
export async function stopContainer(nameOrId: string): Promise<void> {
  await dockerExec(["stop", nameOrId]);
}
