/**
 * Low-level GitHub API HTTP client.
 *
 * - Injects Authorization and Accept headers automatically.
 * - Parses JSON responses.
 * - Throws GitHubApiError on non-2xx responses.
 * - Enforces a minimum 1-second gap between successive write calls
 *   (POST / PATCH / PUT / DELETE) to respect GitHub's secondary rate limits.
 */

/** Error thrown when the GitHub API responds with a non-2xx status. */
export class GitHubApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(`GitHub API error ${status}: ${message}`);
    this.name = "GitHubApiError";
  }
}

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export class GitHubClient {
  private lastWriteAt = 0;

  constructor(private readonly token: string) {}

  async request<T>(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<T> {
    if (WRITE_METHODS.has(method.toUpperCase())) {
      const elapsed = Date.now() - this.lastWriteAt;
      if (elapsed < 1000) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, 1000 - elapsed),
        );
      }
      this.lastWriteAt = Date.now();
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const errBody = (await response.json()) as { message?: string };
        if (errBody.message) message = errBody.message;
      } catch {
        // ignore JSON parse errors — use statusText
      }
      throw new GitHubApiError(response.status, message);
    }

    // 204 No Content — return empty object cast to T
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  get<T>(url: string): Promise<T> {
    return this.request<T>("GET", url);
  }

  post<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", url, body);
  }

  patch<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", url, body);
  }

  delete<T = void>(url: string): Promise<T> {
    return this.request<T>("DELETE", url);
  }
}
