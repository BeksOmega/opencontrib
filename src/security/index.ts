import path from 'path';

export { validateDiff } from './diff-validator';
export type { DiffValidationResult } from './diff-validator';

export const SYSTEM_PROMPT_PATH = path.join(__dirname, 'system-prompt.txt');
