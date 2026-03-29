import { execFile } from "child_process";

/** Error thrown when a docker command exits with a non-zero code. */
export class DockerError extends Error {
  constructor(
    public readonly args: string[],
    public readonly exitCode: number | null,
    public readonly stderr: string
  ) {
    super(`docker ${args[0] ?? ""} failed (exit ${exitCode}): ${stderr}`);
    this.name = "DockerError";
  }
}

/**
 * Thin wrapper around `execFile('docker', args)`.
 * Never uses a shell — arguments are passed directly to prevent injection.
 */
export function dockerExec(
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile("docker", args, (err, stdout, stderr) => {
      if (err) {
        const code =
          typeof (err as NodeJS.ErrnoException).code === "number"
            ? ((err as NodeJS.ErrnoException).code as unknown as number)
            : null;
        reject(new DockerError(args, code, stderr || String(err)));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}
