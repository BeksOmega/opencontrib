import nock from "nock";
import { GitHubClient } from "../client";
import { forkRepo, deleteFork, getRepoInfo, getFileContent, listLabels } from "../repos";

const BASE = "https://api.github.com";

beforeEach(() => nock.cleanAll());
afterAll(() => nock.restore());

const client = new GitHubClient("test-token");

describe("forkRepo", () => {
  it("returns forkOwner and forkRepo", async () => {
    nock(BASE)
      .post("/repos/owner/repo/forks")
      .reply(202, { owner: { login: "myuser" }, name: "repo" });
    const result = await forkRepo(client, "owner", "repo");
    expect(result).toEqual({ forkOwner: "myuser", forkRepo: "repo" });
  });

  it("throws GitHubApiError on failure", async () => {
    nock(BASE).post("/repos/owner/repo/forks").reply(403, { message: "Forbidden" });
    await expect(forkRepo(client, "owner", "repo")).rejects.toMatchObject({ status: 403 });
  });
});

describe("deleteFork", () => {
  it("resolves on 204", async () => {
    nock(BASE).delete("/repos/myuser/repo").reply(204);
    await expect(deleteFork(client, "myuser", "repo")).resolves.toBeUndefined();
  });
});

describe("getRepoInfo", () => {
  it("maps fields correctly", async () => {
    nock(BASE)
      .get("/repos/owner/repo")
      .reply(200, { stargazers_count: 42, language: "TypeScript", default_branch: "main" });
    const result = await getRepoInfo(client, "owner", "repo");
    expect(result).toEqual({ stars: 42, language: "TypeScript", defaultBranch: "main" });
  });
});

describe("getFileContent", () => {
  it("decodes base64 content and returns sha", async () => {
    const content = "hello world";
    nock(BASE)
      .get("/repos/owner/repo/contents/README.md")
      .reply(200, {
        content: Buffer.from(content).toString("base64"),
        sha: "abc123",
        encoding: "base64",
      });
    const result = await getFileContent(client, "owner", "repo", "README.md");
    expect(result).toEqual({ content: "hello world", sha: "abc123" });
  });

  it("returns null on 404", async () => {
    nock(BASE)
      .get("/repos/owner/repo/contents/MISSING.md")
      .reply(404, { message: "Not Found" });
    const result = await getFileContent(client, "owner", "repo", "MISSING.md");
    expect(result).toBeNull();
  });

  it("rethrows non-404 errors", async () => {
    nock(BASE)
      .get("/repos/owner/repo/contents/secret.md")
      .reply(403, { message: "Forbidden" });
    await expect(getFileContent(client, "owner", "repo", "secret.md")).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("listLabels", () => {
  it("returns label names", async () => {
    nock(BASE)
      .get("/repos/owner/repo/labels?per_page=100")
      .reply(200, [{ name: "bug" }, { name: "good-first-issue" }]);
    const result = await listLabels(client, "owner", "repo");
    expect(result).toEqual(["bug", "good-first-issue"]);
  });
});
