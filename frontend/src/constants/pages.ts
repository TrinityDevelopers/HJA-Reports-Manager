export const PAGES = {
  LAB_REQUESTS: 'labRequests',
  REPORTS: 'reports',
  REPORTS_EDITOR: 'reportsEditor',
  PROJECTS: 'projects',
  DATABASE: 'database',
  SETTINGS: 'settings',
} as const;

export type PageType = (typeof PAGES)[keyof typeof PAGES];
