import nock from "nock";
import { GitHubClient, GitHubApiError } from "../client";

const BASE = "https://api.github.com";
const TOKEN = "test-token";

beforeEach(() => nock.cleanAll());
afterAll(() => nock.restore());

describe("GitHubClient", () => {
  describe("GET request", () => {
    it("parses a successful JSON response", async () => {
      nock(BASE).get("/repos/owner/repo").reply(200, { name: "repo" });
      const client = new GitHubClient(TOKEN);
      const result = await client.get<{ name: string }>(`${BASE}/repos/owner/repo`);
      expect(result).toEqual({ name: "repo" });
    });

    it("sends Authorization and Accept headers", async () => {
      nock(BASE, {
        reqheaders: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
        },
      })
        .get("/repos/owner/repo")
        .reply(200, {});
      const client = new GitHubClient(TOKEN);
      await expect(client.get(`${BASE}/repos/owner/repo`)).resolves.toBeDefined();
    });

    it("throws GitHubApiError with status and message on non-2xx", async () => {
      nock(BASE).get("/repos/missing/repo").reply(404, { message: "Not Found" });
      const client = new GitHubClient(TOKEN);
      await expect(client.get(`${BASE}/repos/missing/repo`)).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining("Not Found"),
      });
    });

    it("thrown error is instance of GitHubApiError", async () => {
      nock(BASE).get("/repos/missing/repo").reply(403, { message: "Forbidden" });
      const client = new GitHubClient(TOKEN);
      await expect(client.get(`${BASE}/repos/missing/repo`)).rejects.toBeInstanceOf(
        GitHubApiError,
      );
    });
  });

  describe("write rate limiting", () => {
    it("enforces at least 1000ms between successive write calls", async () => {
      nock(BASE).post("/repos/owner/repo/forks").reply(202, { owner: { login: "me" }, name: "repo" });
      nock(BASE).post("/repos/owner/repo2/forks").reply(202, { owner: { login: "me" }, name: "repo2" });

      const client = new GitHubClient(TOKEN);
      const start = Date.now();
      await client.post(`${BASE}/repos/owner/repo/forks`);
      await client.post(`${BASE}/repos/owner/repo2/forks`);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(1000);
    }, 5000);

    it("does not throttle GET requests", async () => {
      nock(BASE).get("/repos/owner/repo").reply(200, {});
      nock(BASE).get("/repos/owner/repo2").reply(200, {});

      const client = new GitHubClient(TOKEN);
      const start = Date.now();
      await client.get(`${BASE}/repos/owner/repo`);
      await client.get(`${BASE}/repos/owner/repo2`);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});
