import { z } from 'zod';

/**
 * Zod schema for the raw opencontrib.yml format.
 * Uses kebab-case keys matching the YAML file exactly.
 * All sections except `targets` are optional — defaults are applied in loader.ts.
 */
export const RawConfigSchema = z.object({
  targets: z.object({
    repos: z.array(z.string().regex(/^[^*]+\/[^*]+$/, 'must be an explicit "owner/repo" — wildcards are not allowed')),
    languages: z.array(z.enum(['typescript', 'javascript', 'python', 'rust', 'go'])),
  }).strict(),
  schedule: z.object({
    'max-issues-per-night': z.number().int().positive().optional(),
    'max-followups-per-night': z.number().int().positive().optional(),
    'max-issues-per-repo': z.number().int().positive().optional(),
    'run-at': z.string().optional(),
  }).strict().optional(),
  autonomy: z.object({
    'pr-mode': z.enum(['draft', 'publish']).optional(),
  }).strict().optional(),
  agent: z.object({
    driver: z.enum(['claude', 'gemini', 'codex', 'opencode']).optional(),
    'max-turns': z.number().int().positive().optional(),
  }).strict().optional(),
  notifications: z.object({
    webhook: z.string().url().optional(),
  }).strict().optional(),
}).strict();

export type RawConfig = z.infer<typeof RawConfigSchema>;
