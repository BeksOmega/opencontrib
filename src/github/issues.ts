import { Issue, IssueComment } from "../types";
import { GitHubClient } from "./client";

const BASE = "https://api.github.com";

interface RawIssue {
  number: number;
  title: string;
  body: string | null;
  labels: Array<{ name: string }>;
  comments: number;
  repository?: { stargazers_count: number };
  created_at: string;
  pull_request?: unknown;
}

interface RawComment {
  id: number;
  user: { login: string };
  body: string;
  created_at: string;
  updated_at: string;
}

function buildIssueQuery(
  owner: string,
  repo: string,
  opts: { labels?: string[]; state?: "open" | "closed" | "all"; since?: Date },
): string {
  const params = new URLSearchParams({ per_page: "100" });
  if (opts.state) params.set("state", opts.state);
  if (opts.labels?.length) params.set("labels", opts.labels.join(","));
  if (opts.since) params.set("since", opts.since.toISOString());
  return `${BASE}/repos/${owner}/${repo}/issues?${params}`;
}

function rawToIssue(owner: string, repo: string, raw: RawIssue): Issue {
  return {
    owner,
    repo,
    number: raw.number,
    title: raw.title,
    body: raw.body ?? "",
    labels: raw.labels.map((l) => l.name),
    commentCount: raw.comments,
    repoStars: raw.repository?.stargazers_count ?? 0,
    createdAt: raw.created_at,
    score: 0,
  };
}

function rawToComment(raw: RawComment): IssueComment {
  return {
    id: raw.id,
    author: raw.user.login,
    body: raw.body,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function listIssues(
  client: GitHubClient,
  owner: string,
  repo: string,
  opts: {
    labels?: string[];
    state?: "open" | "closed" | "all";
    since?: Date;
  },
): Promise<Issue[]> {
  return client
    .get<RawIssue[]>(buildIssueQuery(owner, repo, opts))
    .then((items) => items.filter((raw) => !raw.pull_request).map((raw) => rawToIssue(owner, repo, raw)));
}

export function getIssue(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
): Promise<Issue> {
  return client
    .get<RawIssue>(`${BASE}/repos/${owner}/${repo}/issues/${number}`)
    .then((raw) => rawToIssue(owner, repo, raw));
}

export function listComments(
  client: GitHubClient,
  owner: string,
  repo: string,
  issueNumber: number,
  since?: Date,
): Promise<IssueComment[]> {
  const params = new URLSearchParams({ per_page: "100" });
  if (since) params.set("since", since.toISOString());
  return client
    .get<RawComment[]>(
      `${BASE}/repos/${owner}/${repo}/issues/${issueNumber}/comments?${params}`,
    )
    .then((items) => items.map(rawToComment));
}

export function postComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<{ id: number }> {
  return client
    .post<{ id: number }>(
      `${BASE}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      { body },
    )
    .then((data) => ({ id: data.id }));
}

export function editComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  commentId: number,
  body: string,
): Promise<void> {
  return client
    .patch(`${BASE}/repos/${owner}/${repo}/issues/comments/${commentId}`, {
      body,
    })
    .then(() => undefined);
}
