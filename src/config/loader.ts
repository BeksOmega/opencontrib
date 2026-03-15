import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import type { ZodError } from 'zod';
import { RawConfigSchema } from './schema';
import { DEFAULT_AGENT, DEFAULT_AUTONOMY, DEFAULT_SCHEDULE } from './defaults';
import type { Config } from '../types';

const CONFIG_SEARCH_PATHS = [
  './opencontrib.yml',
  path.join(os.homedir(), 'opencontrib.yml'),
];

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '<root>';
      return `"${fieldPath}": ${issue.message}`;
    })
    .join('\n');
}

/**
 * Parses a YAML string into a validated, defaults-applied Config object.
 * Exported for testing — prefer loadConfig for production use.
 */
export function parseConfig(content: string): Config {
  let raw: unknown;
  try {
    raw = parseYaml(content);
  } catch (err) {
    throw new Error(`Failed to parse YAML: ${(err as Error).message}`);
  }

  const result = RawConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${formatZodError(result.error)}`);
  }

  const r = result.data;
  return {
    targets: {
      repos: r.targets.repos,
      languages: r.targets.languages,
    },
    schedule: {
      maxNewIssues: r.schedule?.['max-issues-per-night'] ?? DEFAULT_SCHEDULE.maxNewIssues,
      maxFollowupsPerNight: r.schedule?.['max-followups-per-night'] ?? DEFAULT_SCHEDULE.maxFollowupsPerNight,
      maxNewIssuesPerRepo: r.schedule?.['max-issues-per-repo'] ?? DEFAULT_SCHEDULE.maxNewIssuesPerRepo,
      runAt: r.schedule?.['run-at'] ?? DEFAULT_SCHEDULE.runAt,
    },
    autonomy: {
      prMode: r.autonomy?.['pr-mode'] ?? DEFAULT_AUTONOMY.prMode,
    },
    agent: {
      driver: r.agent?.driver ?? DEFAULT_AGENT.driver,
      maxTurns: r.agent?.['max-turns'] ?? DEFAULT_AGENT.maxTurns,
    },
    notifications: {
      webhook: r.notifications?.webhook,
    },
  };
}

/**
 * Searches for opencontrib.yml in the standard locations and returns the path.
 * Throws if no config file is found.
 */
export function findConfig(): string {
  for (const candidate of CONFIG_SEARCH_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `No opencontrib.yml found. Searched:\n${CONFIG_SEARCH_PATHS.map((p) => `  ${p}`).join('\n')}`
  );
}

/**
 * Reads the config file at `filePath`, parses the YAML, applies defaults,
 * validates against the schema, and returns a fully-typed Config object.
 * Throws a descriptive error on validation failure or if the file is not found.
 */
export function loadConfig(filePath: string): Config {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Could not read config file at "${filePath}": ${(err as NodeJS.ErrnoException).message}`);
  }
  return parseConfig(content);
}
