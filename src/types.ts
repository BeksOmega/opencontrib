/**
 * Shared TypeScript interfaces used across the opencontrib codebase.
 * All modules import their types from here.
 */

// ---------------------------------------------------------------------------
// Config (parsed from opencontrib.yml)
// ---------------------------------------------------------------------------

/** Repo/language targeting rules. */
export interface ConfigTargets {
  /** Glob patterns or explicit "owner/repo" strings to target. */
  repos: string[];
  /** Languages to filter by (e.g. "typescript", "python"). */
  languages: string[];
}

/** Nightly scheduling limits. */
export interface ConfigSchedule {
  /** Maximum number of new-issue jobs to run per nightly invocation. */
  maxIssuesPerNight: number;
  /** Maximum number of PR follow-up jobs to run per nightly invocation. */
  maxFollowupsPerNight: number;
  /** Maximum number of jobs per repo per nightly invocation. */
  maxIssuesPerRepo: number;
}

/** Autonomy settings controlling how PRs are opened. */
export interface ConfigAutonomy {
  /** "draft" opens PRs as draft; "publish" opens them as ready-for-review. */
  prMode: "draft" | "publish";
}

/** Agent driver settings. */
export interface ConfigAgent {
  /** Which agent CLI to use. */
  driver: "claude" | "gemini" | "codex" | "opencode";
  /** Maximum turns per agent session (keeps each job short). */
  maxTurns: number;
}

/** Optional notification channel. */
export interface ConfigNotifications {
  /** ntfy.sh (or compatible) webhook URL to POST run summaries to. */
  webhook?: string;
}

/** Parsed representation of opencontrib.yml. */
export interface Config {
  /** Repo and language targeting rules. */
  targets: ConfigTargets;
  /** Nightly scheduling limits. */
  schedule: ConfigSchedule;
  /** Autonomy settings. */
  autonomy: ConfigAutonomy;
  /** Agent driver settings. */
  agent: ConfigAgent;
  /** Optional notification settings. */
  notifications: ConfigNotifications;
}

// ---------------------------------------------------------------------------
// RepoMeta (cached per-repo analysis result)
// ---------------------------------------------------------------------------

/** Cached result of the per-repo analysis run at init/sync time. */
export interface RepoMeta {
  /** GitHub repo owner. */
  owner: string;
  /** GitHub repo name. */
  repo: string;
  /** Whether the repo has an AI-hostile policy. */
  aiHostile: boolean;
  /** Human-readable reason why the repo is considered AI-hostile, if applicable. */
  aiHostileReason: string | null;
  /** Issue labels that indicate an issue explicitly welcomes bot contributions. */
  botWelcomeLabels: string[];
  /** Whether contributors must post a claim comment before starting work. */
  requiresClaimComment: boolean;
  /** Whether contributors must self-assign the issue before starting work. */
  requiresSelfAssign: boolean;
  /** Free-text claim instructions extracted from CONTRIBUTING.md, if any. */
  claimInstructions: string | null;
  /** SHA of CONTRIBUTING.md at last analysis (used for cache invalidation). */
  contributingMdSha: string | null;
  /** SHA of README at last analysis (used for cache invalidation). */
  readmeSha: string | null;
  /** SHA of AGENTS.md at last analysis (used for cache invalidation). */
  agentsMdSha: string | null;
  /** Contents of AGENTS.md to append to the agent system prompt, if present. */
  agentsMdContent: string | null;
  /** ISO timestamp of when this cache entry was written. */
  cachedAt: string;
}

// ---------------------------------------------------------------------------
// Issue (a GitHub issue as used internally)
// ---------------------------------------------------------------------------

/** A GitHub issue as used internally by the opportunity finder and orchestrator. */
export interface Issue {
  /** GitHub repo owner. */
  owner: string;
  /** GitHub repo name. */
  repo: string;
  /** Issue number. */
  number: number;
  /** Issue title. */
  title: string;
  /** Issue body text. */
  body: string;
  /** Current labels on the issue. */
  labels: string[];
  /** Number of comments on the issue. */
  commentCount: number;
  /** Star count of the repo (used for scoring). */
  repoStars: number;
  /** ISO timestamp when the issue was opened. */
  createdAt: string;
  /** Opportunity score computed by the scorer (higher = better). */
  score: number;
}

// ---------------------------------------------------------------------------
// JobState (state of a single job run)
// ---------------------------------------------------------------------------

/** Whether the job targeted a new issue or a PR follow-up. */
export type JobType = "new-issue" | "pr-followup";

/** Terminal outcome of a job. */
export type JobOutcome =
  | "success"       // PR opened (new-issue) or changes pushed (followup)
  | "no-changes"    // Agent produced no diff
  | "diff-rejected" // Orchestrator's diff validation failed
  | "aborted"       // Monitoring loop detected an abort condition
  | "error";        // Unexpected runtime error

/** State of a single job run (new issue fix or PR follow-up). */
export interface JobState {
  /** Unique job identifier (e.g. "issue-123" or "pr-456-followup-1"). */
  id: string;
  /** Type of job. */
  type: JobType;
  /** GitHub repo owner. */
  owner: string;
  /** GitHub repo name. */
  repo: string;
  /** Issue or PR number being worked on. */
  issueOrPrNumber: number;
  /** ISO timestamp when the job started. */
  startedAt: string;
  /** ISO timestamp when the job finished, or null if still running. */
  finishedAt: string | null;
  /** Terminal outcome, or null if still running. */
  outcome: JobOutcome | null;
  /** URL of the PR opened by this job, if any. */
  prUrl: string | null;
  /** Dollar spend reported by the agent driver for this job. */
  spendUsd: number;
  /** Human-readable notes about what happened (abort reason, error message, etc.). */
  notes: string | null;
}

// ---------------------------------------------------------------------------
// RunState (persisted nightly run state at ~/.opencontrib/state.json)
// ---------------------------------------------------------------------------

/** Persisted nightly run state written to ~/.opencontrib/state.json. */
export interface RunState {
  /** ISO date string (YYYY-MM-DD) for the current run day. Resets at midnight. */
  date: string;
  /** Number of new-issue jobs attempted today. */
  issuesAttempted: number;
  /** Number of PR follow-up jobs attempted today. */
  followupsAttempted: number;
  /** ISO timestamp of the last orchestrator run start. */
  lastRun: string | null;
  /** Per-job records from all runs, newest first. */
  runs: JobState[];
}

// ---------------------------------------------------------------------------
// AgentResult (return value from an agent driver invocation)
// ---------------------------------------------------------------------------

/** Return value from an agent driver invocation. */
export interface AgentResult {
  /** Process exit code of the agent CLI (0 = success). */
  exitCode: number;
  /** Dollar spend for this invocation as reported by the agent CLI. */
  spendUsd: number;
}
