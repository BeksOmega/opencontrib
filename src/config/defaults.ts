import type { ConfigAgent, ConfigAutonomy, ConfigSchedule } from '../types';

export const DEFAULT_SCHEDULE: ConfigSchedule = {
  maxNewIssues: 2,
  maxFollowupsPerNight: 3,
  maxNewIssuesPerRepo: 1,
  runAt: '23:00',
};

export const DEFAULT_AUTONOMY: ConfigAutonomy = {
  prMode: 'draft',
};

export const DEFAULT_AGENT: ConfigAgent = {
  driver: 'claude',
  maxTurns: 30,
};
