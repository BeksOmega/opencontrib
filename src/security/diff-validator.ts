export interface DiffValidationResult {
  valid: boolean;
  violations: string[];
}

const DEFAULT_MAX_LINES_CHANGED = 500;

const CI_CONFIG_PATTERNS: RegExp[] = [
  /^\.github\//,
  /^[^/]+\.ya?ml$/,
  /^Dockerfile(\..+)?$/,
  /^Makefile$/,
  /^\.travis\.yml$/,
  /^circle\.yml$/,
  /^\.circleci\//,
  /^Jenkinsfile$/,
  /^azure-pipelines\.yml$/,
];

const CREDENTIAL_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{36}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

interface FileDiff {
  path: string;
  addedLines: string[];
  removedLines: string[];
}

function parseDiff(diff: string): FileDiff[] {
  const files: FileDiff[] = [];
  let current: FileDiff | null = null;

  for (const line of diff.split('\n')) {
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      // Header lines — extract path from +++ line
      if (line.startsWith('+++ ')) {
        const path = line.slice(4).replace(/^b\//, '');
        if (path !== '/dev/null') {
          current = { path, addedLines: [], removedLines: [] };
          files.push(current);
        }
      }
      continue;
    }
    if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('@@ ')) {
      continue;
    }
    if (current === null) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.addedLines.push(line.slice(1));
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.removedLines.push(line.slice(1));
    }
  }

  return files;
}

function countChangedLines(diff: string): number {
  let count = 0;
  for (const line of diff.split('\n')) {
    if ((line.startsWith('+') && !line.startsWith('+++')) ||
        (line.startsWith('-') && !line.startsWith('---'))) {
      count++;
    }
  }
  return count;
}

function isCiConfigPath(path: string): boolean {
  return CI_CONFIG_PATTERNS.some(pattern => pattern.test(path));
}

/**
 * Returns the section context tokens that precede a given added line in a
 * package.json diff, so we can tell which top-level key it lives under.
 * This is a simple heuristic: scan backwards through added lines for a line
 * that looks like `"dependencies":` or `"devDependencies":`.
 */
function isUnderDependenciesSection(addedLines: string[], lineIndex: number): boolean {
  // Scan backwards for a JSON key that starts a dependency block
  for (let i = lineIndex - 1; i >= 0; i--) {
    const trimmed = addedLines[i].trim();
    if (/^"(dependencies|devDependencies)"\s*:\s*\{/.test(trimmed)) {
      return true;
    }
    // If we hit a closing brace or another top-level key, stop
    if (/^\}/.test(trimmed) || /^"[^"]+"\s*:/.test(trimmed)) {
      return false;
    }
  }
  return false;
}

function checkPackageJsonDeps(file: FileDiff): string | null {
  // We need to determine whether added lines are inside a dependencies block.
  // Strategy: scan the added lines in order, tracking whether we're inside
  // "dependencies" or "devDependencies".
  let inDepBlock = false;
  let braceDepth = 0;

  for (const line of file.addedLines) {
    const trimmed = line.trim();

    if (!inDepBlock) {
      if (/^"(dependencies|devDependencies)"\s*:\s*\{/.test(trimmed)) {
        inDepBlock = true;
        braceDepth = 1;
        continue;
      }
    } else {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0) {
        inDepBlock = false;
        continue;
      }
      // Any non-empty, non-brace-only line inside the dep block is a new dep entry
      if (trimmed && trimmed !== '{' && trimmed !== '}') {
        return `package.json: new dependency entry added: ${trimmed}`;
      }
    }
  }
  return null;
}

function checkRequirementsTxt(file: FileDiff): string | null {
  for (const line of file.addedLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      return `requirements.txt: new package entry added: ${trimmed}`;
    }
  }
  return null;
}

function checkPyprojectToml(file: FileDiff): string | null {
  let inDepSection = false;

  for (const line of file.addedLines) {
    const trimmed = line.trim();

    if (/^\[(project\.dependencies|tool\.poetry\.dependencies)\]/.test(trimmed)) {
      inDepSection = true;
      continue;
    }
    if (/^\[/.test(trimmed)) {
      inDepSection = false;
      continue;
    }
    if (inDepSection && trimmed && !trimmed.startsWith('#')) {
      return `pyproject.toml: new dependency entry added: ${trimmed}`;
    }
  }
  return null;
}

function checkCargoToml(file: FileDiff): string | null {
  let inDepSection = false;

  for (const line of file.addedLines) {
    const trimmed = line.trim();

    if (/^\[(dependencies|dev-dependencies)\]/.test(trimmed)) {
      inDepSection = true;
      continue;
    }
    if (/^\[/.test(trimmed)) {
      inDepSection = false;
      continue;
    }
    if (inDepSection && trimmed && !trimmed.startsWith('#')) {
      return `Cargo.toml: new dependency entry added: ${trimmed}`;
    }
  }
  return null;
}

function checkGoMod(file: FileDiff): string | null {
  let inRequireBlock = false;

  for (const line of file.addedLines) {
    const trimmed = line.trim();

    if (/^require\s*\(/.test(trimmed) || trimmed === 'require (') {
      inRequireBlock = true;
      continue;
    }
    if (inRequireBlock && trimmed === ')') {
      inRequireBlock = false;
      continue;
    }
    // Single-line require: `require module version`
    if (/^require\s+\S+\s+\S+/.test(trimmed)) {
      return `go.mod: new require entry added: ${trimmed}`;
    }
    if (inRequireBlock && trimmed && !trimmed.startsWith('//')) {
      return `go.mod: new require entry added: ${trimmed}`;
    }
  }
  return null;
}

function checkNewDependencies(file: FileDiff): string | null {
  const base = file.path.split('/').pop() ?? '';

  if (base === 'package.json') return checkPackageJsonDeps(file);
  if (base === 'requirements.txt') return checkRequirementsTxt(file);
  if (base === 'pyproject.toml') return checkPyprojectToml(file);
  if (base === 'Cargo.toml') return checkCargoToml(file);
  if (base === 'go.mod') return checkGoMod(file);

  return null;
}

export function validateDiff(
  diff: string,
  opts?: { maxLinesChanged?: number }
): DiffValidationResult {
  const maxLines = opts?.maxLinesChanged ?? DEFAULT_MAX_LINES_CHANGED;
  const violations: string[] = [];

  // Rule 1: Line count
  const lineCount = countChangedLines(diff);
  if (lineCount > maxLines) {
    violations.push(
      `Line count exceeded: ${lineCount} lines changed (limit: ${maxLines})`
    );
  }

  // Rule 3: No binary files
  if (/^Binary files .* differ$/m.test(diff)) {
    violations.push('Binary file changes detected');
  }

  // Parse diff into per-file structures for remaining rules
  const files = parseDiff(diff);

  for (const file of files) {
    // Rule 2: No CI/build config changes
    if (isCiConfigPath(file.path)) {
      violations.push(`CI/build config file modified: ${file.path}`);
    }

    // Rule 4: No new dependency entries
    const depViolation = checkNewDependencies(file);
    if (depViolation !== null) {
      violations.push(depViolation);
    }

    // Rule 5: Credential pattern scan (added lines only)
    for (const line of file.addedLines) {
      for (const pattern of CREDENTIAL_PATTERNS) {
        if (pattern.test(line)) {
          violations.push(
            `Credential pattern detected in ${file.path}: ${line.trim()}`
          );
          break; // one violation per line is enough
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
