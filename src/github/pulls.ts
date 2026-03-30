import { PR, ReviewComment, CheckRun } from "../types";
import { GitHubClient } from "./client";

const BASE = "https://api.github.com";

interface RawPR {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  draft: boolean;
  head: { ref: string };
  html_url: string;
  created_at: string;
}

interface RawReviewComment {
  id: number;
  user: { login: string };
  body: string;
  path: string;
  line: number | null;
  created_at: string;
}

interface RawCheckRun {
  id: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: CheckRun["conclusion"];
  html_url: string;
}

function rawToPR(raw: RawPR): PR {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? "",
    state: raw.state,
    draft: raw.draft,
    headBranch: raw.head.ref,
    url: raw.html_url,
    createdAt: raw.created_at,
  };
}

function rawToReviewComment(raw: RawReviewComment): ReviewComment {
  return {
    id: raw.id,
    author: raw.user.login,
    body: raw.body,
    path: raw.path,
    line: raw.line,
    createdAt: raw.created_at,
  };
}

function rawToCheckRun(raw: RawCheckRun): CheckRun {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    conclusion: raw.conclusion,
    url: raw.html_url,
  };
}

export function openPR(
  client: GitHubClient,
  params: {
    upstreamOwner: string;
    upstreamRepo: string;
    forkOwner: string;
    headBranch: string;
    title: string;
    body: string;
    draft: boolean;
  },
): Promise<{ number: number; url: string }> {
  return client
    .post<{ number: number; html_url: string }>(
      `${BASE}/repos/${params.upstreamOwner}/${params.upstreamRepo}/pulls`,
      {
        title: params.title,
        body: params.body,
        head: `${params.forkOwner}:${params.headBranch}`,
        base: "main",
        draft: params.draft,
      },
    )
    .then((data) => ({ number: data.number, url: data.html_url }));
}

export function updatePR(
  client: GitHubClient,
  owner: string,
  repo: string,
  prNumber: number,
  params: {
    title?: string;
    body?: string;
    draft?: boolean;
  },
): Promise<void> {
  return client
    .patch(`${BASE}/repos/${owner}/${repo}/pulls/${prNumber}`, params)
    .then(() => undefined);
}

export function listOpenPRs(
  client: GitHubClient,
  owner: string,
  repo: string,
  headPrefix?: string,
): Promise<PR[]> {
  const url = `${BASE}/repos/${owner}/${repo}/pulls?state=open&per_page=100`;
  return client.get<RawPR[]>(url).then((items) => {
    const prs = items.map(rawToPR);
    if (headPrefix) return prs.filter((pr) => pr.headBranch.startsWith(headPrefix));
    return prs;
  });
}

export function getPRReviewComments(
  client: GitHubClient,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReviewComment[]> {
  return client
    .get<RawReviewComment[]>(
      `${BASE}/repos/${owner}/${repo}/pulls/${prNumber}/comments?per_page=100`,
    )
    .then((items) => items.map(rawToReviewComment));
}

export function replyToReviewComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  prNumber: number,
  commentId: number,
  body: string,
): Promise<void> {
  return client
    .post(
      `${BASE}/repos/${owner}/${repo}/pulls/${prNumber}/comments/${commentId}/replies`,
      { body },
    )
    .then(() => undefined);
}

export function listCheckRuns(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
): Promise<CheckRun[]> {
  return client
    .get<{ check_runs: RawCheckRun[] }>(
      `${BASE}/repos/${owner}/${repo}/commits/${ref}/check-runs?per_page=100`,
    )
    .then((data) => data.check_runs.map(rawToCheckRun));
}

export function deleteBranch(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch: string,
): Promise<void> {
  return client
    .delete(`${BASE}/repos/${owner}/${repo}/git/refs/heads/${branch}`)
    .then(() => undefined);
}
