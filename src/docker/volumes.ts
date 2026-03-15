import { dockerExec, DockerError } from "./exec";

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

/** Returns the workspace volume name for a given owner/repo. */
export function workspaceVolumeName(owner: string, repo: string): string {
  return `opencontrib-${owner}-${repo}`;
}

/** Returns the Claude memory volume name for a given owner/repo. */
export function memoryVolumeName(owner: string, repo: string): string {
  return `opencontrib-mem-${owner}-${repo}`;
}

// ---------------------------------------------------------------------------
// Volume lifecycle
// ---------------------------------------------------------------------------

/** Creates a named Docker volume. */
export async function createVolume(name: string): Promise<void> {
  await dockerExec(["volume", "create", name]);
}

/** Removes a named Docker volume. */
export async function deleteVolume(name: string): Promise<void> {
  await dockerExec(["volume", "rm", name]);
}

/**
 * Returns true if the named Docker volume exists.
 * Uses `docker volume inspect` — exits non-zero if the volume is not found.
 */
export async function volumeExists(name: string): Promise<boolean> {
  try {
    await dockerExec(["volume", "inspect", name]);
    return true;
  } catch (err) {
    if (err instanceof DockerError) {
      return false;
    }
    throw err;
  }
}
