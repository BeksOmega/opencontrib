import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig, parseConfig } from '../loader';
import { DEFAULT_AGENT, DEFAULT_AUTONOMY, DEFAULT_SCHEDULE } from '../defaults';

const FULL_CONFIG_YAML = `
targets:
  repos:
    - "owner/specific-repo"
    - "another/repo"
  languages:
    - typescript
    - javascript

schedule:
  max-issues-per-night: 5
  max-followups-per-night: 4
  max-issues-per-repo: 2
  run-at: "22:00"

autonomy:
  pr-mode: publish

agent:
  driver: gemini
  max-turns: 50

notifications:
  webhook: https://ntfy.sh/my-topic
`;

const MINIMAL_CONFIG_YAML = `
targets:
  repos:
    - "owner/repo"
  languages:
    - python
`;

describe('parseConfig', () => {
  it('parses a fully-specified config correctly', () => {
    const config = parseConfig(FULL_CONFIG_YAML);

    expect(config.targets.repos).toEqual(['owner/specific-repo', 'another/repo']);
    expect(config.targets.languages).toEqual(['typescript', 'javascript']);
    expect(config.schedule.maxNewIssues).toBe(5);
    expect(config.schedule.maxFollowupsPerNight).toBe(4);
    expect(config.schedule.maxNewIssuesPerRepo).toBe(2);
    expect(config.schedule.runAt).toBe('22:00');
    expect(config.autonomy.prMode).toBe('publish');
    expect(config.agent.driver).toBe('gemini');
    expect(config.agent.maxTurns).toBe(50);
    expect(config.notifications.webhook).toBe('https://ntfy.sh/my-topic');
  });

  it('applies defaults for all optional fields when omitted', () => {
    const config = parseConfig(MINIMAL_CONFIG_YAML);

    expect(config.schedule.maxNewIssues).toBe(DEFAULT_SCHEDULE.maxNewIssues);
    expect(config.schedule.maxFollowupsPerNight).toBe(DEFAULT_SCHEDULE.maxFollowupsPerNight);
    expect(config.schedule.maxNewIssuesPerRepo).toBe(DEFAULT_SCHEDULE.maxNewIssuesPerRepo);
    expect(config.schedule.runAt).toBe(DEFAULT_SCHEDULE.runAt);
    expect(config.autonomy.prMode).toBe(DEFAULT_AUTONOMY.prMode);
    expect(config.agent.driver).toBe(DEFAULT_AGENT.driver);
    expect(config.agent.maxTurns).toBe(DEFAULT_AGENT.maxTurns);
    expect(config.notifications.webhook).toBeUndefined();
  });

  it('throws a validation error for unknown top-level fields', () => {
    const yaml = `
targets:
  repos: ["owner/repo"]
  languages: [typescript]
unknown-field: true
`;
    expect(() => parseConfig(yaml)).toThrow(/invalid configuration/i);
  });

  it('throws a validation error for unknown fields in a nested section', () => {
    const yaml = `
targets:
  repos: ["owner/repo"]
  languages: [typescript]
schedule:
  max-issues-per-night: 2
  not-a-real-field: 99
`;
    expect(() => parseConfig(yaml)).toThrow(/invalid configuration/i);
  });

  it('throws a validation error for an invalid pr-mode value', () => {
    const yaml = `
targets:
  repos: ["owner/repo"]
  languages: [typescript]
autonomy:
  pr-mode: instant
`;
    expect(() => parseConfig(yaml)).toThrow(/invalid configuration/i);
  });

  it('throws a validation error for wildcard repo patterns', () => {
    const yaml = `
targets:
  repos: ["sindresorhus/*"]
  languages: [typescript]
`;
    expect(() => parseConfig(yaml)).toThrow(/invalid configuration/i);
  });

  it('throws a validation error for an invalid webhook URL', () => {
    const yaml = `
targets:
  repos: ["owner/repo"]
  languages: [typescript]
notifications:
  webhook: not-a-valid-url
`;
    expect(() => parseConfig(yaml)).toThrow(/invalid configuration/i);
  });

  it('includes the field path in the error message', () => {
    const yaml = `
targets:
  repos: ["owner/repo"]
  languages: [typescript]
autonomy:
  pr-mode: bad-value
`;
    let errorMessage = '';
    try {
      parseConfig(yaml);
    } catch (err) {
      errorMessage = (err as Error).message;
    }
    expect(errorMessage).toMatch(/autonomy\.pr-mode/);
  });
});

describe('loadConfig', () => {
  it('throws a clear error when the config file does not exist', () => {
    expect(() => loadConfig('/nonexistent/path/opencontrib.yml')).toThrow(
      /could not read config file/i
    );
  });

  it('reads and parses a config file from disk', () => {
    const tmpFile = path.join(os.tmpdir(), `opencontrib-test-${Date.now()}.yml`);
    fs.writeFileSync(tmpFile, MINIMAL_CONFIG_YAML, 'utf8');
    try {
      const config = loadConfig(tmpFile);
      expect(config.targets.repos).toEqual(['owner/repo']);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
