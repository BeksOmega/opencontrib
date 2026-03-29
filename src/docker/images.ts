import { dockerExec, DockerError } from "./exec";

// ---------------------------------------------------------------------------
// Language → image mapping
// ---------------------------------------------------------------------------

const LANGUAGE_IMAGE_MAP: Record<string, string> = {
  typescript: "opencontrib-js-image",
  javascript: "opencontrib-js-image",
  python: "opencontrib-py-image",
  rust: "opencontrib-rs-image",
  go: "opencontrib-go-image",
};

const FALLBACK_IMAGE = "opencontrib-js-image";

/**
 * Maps a language string to its base image name.
 * Falls back to the JS image for unknown languages.
 */
export function languageToImage(language: string): string {
  return LANGUAGE_IMAGE_MAP[language.toLowerCase()] ?? FALLBACK_IMAGE;
}

// ---------------------------------------------------------------------------
// Image lifecycle
// ---------------------------------------------------------------------------

/** Pulls a digest-pinned image reference. */
export async function pullImage(imageRef: string): Promise<void> {
  await dockerExec(["pull", imageRef]);
}

/**
 * Returns true if the given image reference exists locally.
 * Uses `docker image inspect` — exits non-zero if the image is not found.
 */
export async function imageExists(imageRef: string): Promise<boolean> {
  try {
    await dockerExec(["image", "inspect", imageRef]);
    return true;
  } catch (err) {
    if (err instanceof DockerError) {
      return false;
    }
    throw err;
  }
}
