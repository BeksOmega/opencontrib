import { validateDiff } from '../diff-validator';

// ---------------------------------------------------------------------------
// Helpers to build minimal unified diffs
// ---------------------------------------------------------------------------

function makeDiff(files: { path: string; added?: string[]; removed?: string[] }[]): string {
  return files
    .map(({ path, added = [], removed = [] }) => {
      const lines = [
        `diff --git a/${path} b/${path}`,
        `index 000000..111111 100644`,
        `--- a/${path}`,
        `+++ b/${path}`,
        `@@ -1,1 +1,1 @@`,
        ...removed.map(l => `-${l}`),
        ...added.map(l => `+${l}`),
      ];
      return lines.join('\n');
    })
    .join('\n');
}

function makeLinesDiff(added: number, removed: number): string {
  const addedLines = Array.from({ length: added }, (_, i) => `+line ${i + 1}`);
  const removedLines = Array.from({ length: removed }, (_, i) => `-old line ${i + 1}`);
  return [
    'diff --git a/foo.ts b/foo.ts',
    'index 000000..111111 100644',
    '--- a/foo.ts',
    '+++ b/foo.ts',
    '@@ -1,1 +1,1 @@',
    ...removedLines,
    ...addedLines,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateDiff', () => {
  test('clean diff → valid: true, empty violations', () => {
    const diff = makeDiff([{ path: 'src/foo.ts', added: [' const x = 1;'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('diff exceeding 500 lines → violation', () => {
    const diff = makeLinesDiff(501, 0);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('Line count exceeded'))).toBe(true);
  });

  test('diff exactly at 500 lines → valid', () => {
    const diff = makeLinesDiff(500, 0);
    const result = validateDiff(diff);
    expect(result.violations.some(v => v.includes('Line count exceeded'))).toBe(false);
  });

  test('custom maxLinesChanged respected', () => {
    const diff = makeLinesDiff(101, 0);
    const result = validateDiff(diff, { maxLinesChanged: 100 });
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('Line count exceeded'))).toBe(true);
  });

  test('diff touching .github/workflows/ci.yml → violation', () => {
    const diff = makeDiff([{ path: '.github/workflows/ci.yml', added: ['  - run: echo hi'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('.github/workflows/ci.yml'))).toBe(true);
  });

  test('diff touching root-level .yml → violation', () => {
    const diff = makeDiff([{ path: 'deploy.yml', added: [' foo: bar'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('deploy.yml'))).toBe(true);
  });

  test('diff touching Dockerfile → violation', () => {
    const diff = makeDiff([{ path: 'Dockerfile', added: ['RUN echo hi'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('Dockerfile'))).toBe(true);
  });

  test('diff touching Makefile → violation', () => {
    const diff = makeDiff([{ path: 'Makefile', added: ['build:'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('Makefile'))).toBe(true);
  });

  test('diff touching .github/workflows/ → violation', () => {
    const diff = makeDiff([{ path: '.github/workflows/release.yml', added: ['  - run: echo'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('.github/workflows/release.yml'))).toBe(true);
  });

  test('diff touching Jenkinsfile → violation', () => {
    const diff = makeDiff([{ path: 'Jenkinsfile', added: ['pipeline {'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('Jenkinsfile'))).toBe(true);
  });

  test('diff touching Jenkinsfile.groovy → violation', () => {
    const diff = makeDiff([{ path: 'Jenkinsfile.groovy', added: ['pipeline {'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('Jenkinsfile.groovy'))).toBe(true);
  });

  test('diff touching .circleci/config.yml → violation', () => {
    const diff = makeDiff([{ path: '.circleci/config.yml', added: ['version: 2'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('.circleci/config.yml'))).toBe(true);
  });

  test('diff touching circleci/config.yml (no leading dot) → violation', () => {
    const diff = makeDiff([{ path: 'circleci/config.yml', added: ['version: 2'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('circleci/config.yml'))).toBe(true);
  });

  test('diff with Binary files line → violation', () => {
    const diff = 'Binary files a/image.png and b/image.png differ';
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('Binary file'))).toBe(true);
  });

  // package.json dependency rules
  test('package.json diff adding a dependency → violation', () => {
    const diff = [
      'diff --git a/package.json b/package.json',
      'index 000000..111111 100644',
      '--- a/package.json',
      '+++ b/package.json',
      '@@ -1,5 +1,6 @@',
      ' {',
      '+  "dependencies": {',
      '+    "lodash": "^4.0.0"',
      '+  }',
      ' }',
    ].join('\n');
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('package.json'))).toBe(true);
  });

  test('package.json diff removing a dependency entry → no violation', () => {
    const diff = [
      'diff --git a/package.json b/package.json',
      'index 000000..111111 100644',
      '--- a/package.json',
      '+++ b/package.json',
      '@@ -1,5 +1,4 @@',
      ' {',
      ' "dependencies": {',
      '-    "lodash": "^4.0.0"',
      ' }',
      ' }',
    ].join('\n');
    const result = validateDiff(diff);
    expect(result.violations.some(v => v.includes('package.json'))).toBe(false);
  });

  // requirements.txt rules
  test('requirements.txt diff adding a package → violation', () => {
    const diff = makeDiff([{ path: 'requirements.txt', added: ['requests==2.31.0'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('requirements.txt'))).toBe(true);
  });

  test('requirements.txt diff adding a comment line → no violation', () => {
    const diff = makeDiff([{ path: 'requirements.txt', added: ['# this is a comment'] }]);
    const result = validateDiff(diff);
    expect(result.violations.some(v => v.includes('requirements.txt'))).toBe(false);
  });

  test('requirements.txt diff removing a package → no violation', () => {
    const diff = makeDiff([{ path: 'requirements.txt', removed: ['requests==2.31.0'] }]);
    const result = validateDiff(diff);
    expect(result.violations.some(v => v.includes('requirements.txt'))).toBe(false);
  });

  // Credential patterns
  test('added line containing ghp_ pattern → violation', () => {
    const token = 'ghp_' + 'A'.repeat(36);
    const diff = makeDiff([{ path: 'config.ts', added: [`const token = "${token}";`] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('config.ts'))).toBe(true);
  });

  test('added line containing AKIA pattern → violation', () => {
    const key = 'AKIA' + '0'.repeat(16);
    const diff = makeDiff([{ path: 'aws.ts', added: [`const key = "${key}";`] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('aws.ts'))).toBe(true);
  });

  test('added line containing sk- Anthropic key → violation', () => {
    const key = 'sk-' + 'a'.repeat(30);
    const diff = makeDiff([{ path: 'ai.ts', added: [`const apiKey = "${key}";`] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('ai.ts'))).toBe(true);
  });

  test('added line containing private key header → violation', () => {
    const diff = makeDiff([{ path: 'key.pem', added: ['-----BEGIN RSA PRIVATE KEY-----'] }]);
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('key.pem'))).toBe(true);
  });

  test('removed line containing a credential pattern → no violation', () => {
    const token = 'ghp_' + 'A'.repeat(36);
    const diff = makeDiff([{ path: 'config.ts', removed: [`const token = "${token}";`] }]);
    const result = validateDiff(diff);
    expect(result.violations.some(v => v.includes('config.ts'))).toBe(false);
  });

  test('multiple violations in one diff → all violations listed', () => {
    const token = 'ghp_' + 'A'.repeat(36);
    const diff = [
      makeDiff([{ path: '.github/workflows/ci.yml', added: ['  - run: echo'] }]),
      makeDiff([{ path: 'secrets.ts', added: [`const t = "${token}";`] }]),
      'Binary files a/image.png and b/image.png differ',
    ].join('\n');
    const result = validateDiff(diff);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });
});
