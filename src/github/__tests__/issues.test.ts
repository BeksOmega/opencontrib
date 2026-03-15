import nock from "nock";
import { GitHubClient } from "../client";
import { listIssues, getIssue, listComments, postComment, editComment } from "../issues";

const BASE = "https://api.github.com";

beforeEach(() => nock.cleanAll());
afterAll(() => nock.restore());

const client = new GitHubClient("test-token");

const RAW_ISSUE = {
  number: 1,
  title: "Fix bug",
  body: "There is a bug",
  labels: [{ name: "bug" }],
  comments: 3,
  created_at: "2025-01-01T00:00:00Z",
};

describe("listIssues", () => {
  it("returns mapped issues", async () => {
    nock(BASE)
      .get(/\/repos\/owner\/repo\/issues/)
      .reply(200, [RAW_ISSUE]);
    const result = await listIssues(client, "owner", "repo", { state: "open" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      owner: "owner",
      repo: "repo",
      number: 1,
      title: "Fix bug",
      labels: ["bug"],
      commentCount: 3,
    });
  });

  it("filters out pull requests", async () => {
    const rawPR = { ...RAW_ISSUE, number: 2, title: "A PR", pull_request: { url: "https://..." } };
    nock(BASE)
      .get(/\/repos\/owner\/repo\/issues/)
      .reply(200, [RAW_ISSUE, rawPR]);
    const result = await listIssues(client, "owner", "repo", { state: "open" });
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
  });
});

describe("getIssue", () => {
  it("returns a single mapped issue", async () => {
    nock(BASE).get("/repos/owner/repo/issues/1").reply(200, RAW_ISSUE);
    const result = await getIssue(client, "owner", "repo", 1);
    expect(result.number).toBe(1);
    expect(result.title).toBe("Fix bug");
  });

  it("throws on non-2xx", async () => {
    nock(BASE).get("/repos/owner/repo/issues/99").reply(404, { message: "Not Found" });
    await expect(getIssue(client, "owner", "repo", 99)).rejects.toMatchObject({ status: 404 });
  });
});

describe("listComments", () => {
  it("returns mapped comments", async () => {
    const rawComment = {
      id: 42,
      user: { login: "alice" },
      body: "I'll look at this",
      created_at: "2025-01-02T00:00:00Z",
      updated_at: "2025-01-02T01:00:00Z",
    };
    nock(BASE)
      .get(/\/repos\/owner\/repo\/issues\/1\/comments/)
      .reply(200, [rawComment]);
    const result = await listComments(client, "owner", "repo", 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 42, author: "alice", body: "I'll look at this" });
  });
});

describe("postComment", () => {
  it("returns the comment id", async () => {
    nock(BASE)
      .post("/repos/owner/repo/issues/1/comments", { body: "hello" })
      .reply(201, { id: 99 });
    const result = await postComment(client, "owner", "repo", 1, "hello");
    expect(result).toEqual({ id: 99 });
  });
});

describe("editComment", () => {
  it("resolves without error", async () => {
    nock(BASE)
      .patch("/repos/owner/repo/issues/comments/42", { body: "updated" })
      .reply(200, { id: 42 });
    await expect(editComment(client, "owner", "repo", 42, "updated")).resolves.toBeUndefined();
  });
});
