/**
 * Public API for the GitHub module.
 *
 * The rest of the codebase imports from here and calls methods on the
 * GitHubClient returned by createGitHubClient. Nothing outside this module
 * constructs GitHub API URLs or sets Authorization headers directly.
 */

import { GitHubClient } from "./client";
import { forkRepo, deleteFork, getRepoInfo, getFileContent, listLabels } from "./repos";
import { listIssues, getIssue, listComments, postComment, editComment } from "./issues";
import {
  openPR,
  updatePR,
  listOpenPRs,
  getPRReviewComments,
  replyToReviewComment,
  listCheckRuns,
  deleteBranch,
} from "./pulls";
import { Issue, IssueComment, PR, ReviewComment, CheckRun } from "../types";

export { GitHubApiError } from "./client";
export type { Issue, IssueComment, PR, ReviewComment, CheckRun };

export interface GitHubClientFacade {
  // Repos
  forkRepo(owner: string, repo: string): Promise<{ forkOwner: string; forkRepo: string }>;
  deleteFork(owner: string, repo: string): Promise<void>;
  getRepoInfo(owner: string, repo: string): Promise<{ stars: number; language: string; defaultBranch: string }>;
  getFileContent(owner: string, repo: string, path: string): Promise<{ content: string; sha: string } | null>;
  listLabels(owner: string, repo: string): Promise<string[]>;

  // Issues
  listIssues(
    owner: string,
    repo: string,
    opts: { labels?: string[]; state?: "open" | "closed" | "all"; since?: Date },
  ): Promise<Issue[]>;
  getIssue(owner: string, repo: string, number: number): Promise<Issue>;
  listComments(owner: string, repo: string, issueNumber: number, since?: Date): Promise<IssueComment[]>;
  postComment(owner: string, repo: string, issueNumber: number, body: string): Promise<{ id: number }>;
  editComment(owner: string, repo: string, commentId: number, body: string): Promise<void>;

  // Pull requests
  openPR(params: {
    upstreamOwner: string;
    upstreamRepo: string;
    forkOwner: string;
    headBranch: string;
    title: string;
    body: string;
    draft: boolean;
  }): Promise<{ number: number; url: string }>;
  updatePR(
    owner: string,
    repo: string,
    prNumber: number,
    params: { title?: string; body?: string; draft?: boolean },
  ): Promise<void>;
  listOpenPRs(owner: string, repo: string, headPrefix?: string): Promise<PR[]>;
  getPRReviewComments(owner: string, repo: string, prNumber: number): Promise<ReviewComment[]>;
  replyToReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    commentId: number,
    body: string,
  ): Promise<void>;
  listCheckRuns(owner: string, repo: string, ref: string): Promise<CheckRun[]>;
  deleteBranch(owner: string, repo: string, branch: string): Promise<void>;
}

/** Create a GitHub API client bound to the given personal access token. */
export function createGitHubClient(token: string): GitHubClientFacade {
  const client = new GitHubClient(token);

  return {
    forkRepo: (owner, repo) => forkRepo(client, owner, repo),
    deleteFork: (owner, repo) => deleteFork(client, owner, repo),
    getRepoInfo: (owner, repo) => getRepoInfo(client, owner, repo),
    getFileContent: (owner, repo, path) => getFileContent(client, owner, repo, path),
    listLabels: (owner, repo) => listLabels(client, owner, repo),

    listIssues: (owner, repo, opts) => listIssues(client, owner, repo, opts),
    getIssue: (owner, repo, number) => getIssue(client, owner, repo, number),
    listComments: (owner, repo, issueNumber, since) => listComments(client, owner, repo, issueNumber, since),
    postComment: (owner, repo, issueNumber, body) => postComment(client, owner, repo, issueNumber, body),
    editComment: (owner, repo, commentId, body) => editComment(client, owner, repo, commentId, body),

    openPR: (params) => openPR(client, params),
    updatePR: (owner, repo, prNumber, params) => updatePR(client, owner, repo, prNumber, params),
    listOpenPRs: (owner, repo, headPrefix) => listOpenPRs(client, owner, repo, headPrefix),
    getPRReviewComments: (owner, repo, prNumber) => getPRReviewComments(client, owner, repo, prNumber),
    replyToReviewComment: (owner, repo, prNumber, commentId, body) =>
      replyToReviewComment(client, owner, repo, prNumber, commentId, body),
    listCheckRuns: (owner, repo, ref) => listCheckRuns(client, owner, repo, ref),
    deleteBranch: (owner, repo, branch) => deleteBranch(client, owner, repo, branch),
  };
}
