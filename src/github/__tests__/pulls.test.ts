import nock from "nock";
import { GitHubClient } from "../client";
import {
  openPR,
  updatePR,
  listOpenPRs,
  getPRReviewComments,
  replyToReviewComment,
  listCheckRuns,
  deleteBranch,
} from "../pulls";

const BASE = "https://api.github.com";

beforeEach(() => nock.cleanAll());
afterAll(() => nock.restore());

const client = new GitHubClient("test-token");

const RAW_PR = {
  number: 7,
  title: "Fix null check",
  body: "Fixes #1",
  state: "open",
  draft: true,
  head: { ref: "opencontrib/issue-1-fix-null" },
  html_url: "https://github.com/owner/repo/pull/7",
  created_at: "2025-01-03T00:00:00Z",
};

describe("openPR", () => {
  it("returns number and url", async () => {
    nock(BASE)
      .post("/repos/upstream/repo/pulls")
      .reply(201, { number: 7, html_url: "https://github.com/upstream/repo/pull/7" });
    const result = await openPR(client, {
      upstreamOwner: "upstream",
      upstreamRepo: "repo",
      forkOwner: "me",
      headBranch: "opencontrib/issue-1",
      title: "Fix it",
      body: "Details",
      draft: true,
    });
    expect(result).toEqual({ number: 7, url: "https://github.com/upstream/repo/pull/7" });
  });

  it("throws on non-2xx", async () => {
    nock(BASE).post("/repos/upstream/repo/pulls").reply(422, { message: "Unprocessable" });
    await expect(
      openPR(client, {
        upstreamOwner: "upstream",
        upstreamRepo: "repo",
        forkOwner: "me",
        headBranch: "opencontrib/issue-1",
        title: "Fix it",
        body: "",
        draft: false,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("updatePR", () => {
  it("resolves without error", async () => {
    nock(BASE).patch("/repos/owner/repo/pulls/7").reply(200, RAW_PR);
    await expect(updatePR(client, "owner", "repo", 7, { title: "Updated" })).resolves.toBeUndefined();
  });
});

describe("listOpenPRs", () => {
  it("returns all open PRs when no headPrefix", async () => {
    nock(BASE).get("/repos/owner/repo/pulls?state=open&per_page=100").reply(200, [RAW_PR]);
    const result = await listOpenPRs(client, "owner", "repo");
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(7);
  });

  it("filters by headPrefix", async () => {
    const otherPR = { ...RAW_PR, number: 8, head: { ref: "feature/something" } };
    nock(BASE)
      .get("/repos/owner/repo/pulls?state=open&per_page=100")
      .reply(200, [RAW_PR, otherPR]);
    const result = await listOpenPRs(client, "owner", "repo", "opencontrib/");
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(7);
  });
});

describe("getPRReviewComments", () => {
  it("returns mapped review comments", async () => {
    const rawComment = {
      id: 55,
      user: { login: "reviewer" },
      body: "Please fix this",
      path: "src/foo.ts",
      line: 10,
      created_at: "2025-01-04T00:00:00Z",
    };
    nock(BASE)
      .get("/repos/owner/repo/pulls/7/comments?per_page=100")
      .reply(200, [rawComment]);
    const result = await getPRReviewComments(client, "owner", "repo", 7);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 55, author: "reviewer", path: "src/foo.ts" });
  });
});

describe("replyToReviewComment", () => {
  it("resolves without error", async () => {
    nock(BASE)
      .post("/repos/owner/repo/pulls/7/comments/55/replies", { body: "Done" })
      .reply(201, {});
    await expect(
      replyToReviewComment(client, "owner", "repo", 7, 55, "Done"),
    ).resolves.toBeUndefined();
  });
});

describe("listCheckRuns", () => {
  it("returns mapped check runs", async () => {
    const rawCheckRun = {
      id: 100,
      name: "CI / build",
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/owner/repo/runs/100",
    };
    nock(BASE)
      .get("/repos/owner/repo/commits/abc123/check-runs?per_page=100")
      .reply(200, { check_runs: [rawCheckRun] });
    const result = await listCheckRuns(client, "owner", "repo", "abc123");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 100,
      name: "CI / build",
      status: "completed",
      conclusion: "success",
    });
  });
});

describe("deleteBranch", () => {
  it("resolves without error", async () => {
    nock(BASE)
      .delete("/repos/owner/repo/git/refs/heads/opencontrib/issue-1")
      .reply(204);
    await expect(
      deleteBranch(client, "owner", "repo", "opencontrib/issue-1"),
    ).resolves.toBeUndefined();
  });
});
