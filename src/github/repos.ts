import { GitHubClient } from "./client";

const BASE = "https://api.github.com";

interface ForkResponse {
  owner: { login: string };
  name: string;
}

interface RepoResponse {
  stargazers_count: number;
  language: string | null;
  default_branch: string;
}

interface ContentResponse {
  content: string;
  sha: string;
  encoding: string;
}

interface LabelResponse {
  name: string;
}

export function forkRepo(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<{ forkOwner: string; forkRepo: string }> {
  return client
    .post<ForkResponse>(`${BASE}/repos/${owner}/${repo}/forks`)
    .then((data) => ({ forkOwner: data.owner.login, forkRepo: data.name }));
}

export function deleteFork(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<void> {
  return client.delete(`${BASE}/repos/${owner}/${repo}`);
}

export function getRepoInfo(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<{ stars: number; language: string; defaultBranch: string }> {
  return client
    .get<RepoResponse>(`${BASE}/repos/${owner}/${repo}`)
    .then((data) => ({
      stars: data.stargazers_count,
      language: data.language ?? "",
      defaultBranch: data.default_branch,
    }));
}

export async function getFileContent(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
): Promise<{ content: string; sha: string } | null> {
  const { GitHubApiError } = await import("./client");
  try {
    const data = await client.get<ContentResponse>(
      `${BASE}/repos/${owner}/${repo}/contents/${path}`,
    );
    const decoded =
      data.encoding === "base64"
        ? Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8")
        : data.content;
    return { content: decoded, sha: data.sha };
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 404) return null;
    throw err;
  }
}

export function listLabels(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<string[]> {
  return client
    .get<LabelResponse[]>(`${BASE}/repos/${owner}/${repo}/labels?per_page=100`)
    .then((labels) => labels.map((l) => l.name));
}
