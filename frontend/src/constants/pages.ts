export const PAGES = {
  LAB_REQUESTS: 'labRequests',
  REPORTS: 'reports',
  PROJECTS: 'projects',
  DATABASE: 'database',
  SETTINGS: 'settings',
} as const;

export type PageType = (typeof PAGES)[keyof typeof PAGES];
