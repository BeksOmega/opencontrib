import { dockerExec, DockerError } from "./exec";

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

/** Returns the workspace volume name for a given owner/repo. */
export function workspaceVolumeName(owner: string, repo: string): string {
  return `opencontrib-${owner}-${repo}`;
}

/**
 * Returns the per-repo Claude memory volume name (CLAUDE.md notes, project
 * context, etc.). Mounted at CLAUDE_MEMORY_MOUNT, inside the credentials
 * volume, so per-repo memory is isolated while credentials are shared.
 */
export function memoryVolumeName(owner: string, repo: string): string {
  return `opencontrib-mem-${owner}-${repo}`;
}

/**
 * The single shared credentials volume name.
 * Created once at `opencontrib init` by running `claude login` on the host
 * and copying the resulting credentials into this volume. Mounted into every
 * agent container at CLAUDE_CREDENTIALS_MOUNT so the Claude Code CLI can use
 * the user's subscription credits rather than API credits.
 */
export function credentialsVolumeName(): string {
  return "opencontrib-credentials";
}

// ---------------------------------------------------------------------------
// Mount path constants
// ---------------------------------------------------------------------------

/**
 * Container path where the shared credentials volume is mounted.
 * Claude Code reads its login credentials from this directory.
 */
export const CLAUDE_CREDENTIALS_MOUNT = "/root/.claude";

/**
 * Container path where the per-repo memory volume is mounted.
 * Must be a subdirectory of CLAUDE_CREDENTIALS_MOUNT so Docker overlays it
 * on top of the credentials mount without disturbing credential files.
 */
export const CLAUDE_MEMORY_MOUNT = "/root/.claude/projects";

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
