export const PAGES = {
  LAB_REQUESTS: 'labRequests',
  REPORTS: 'reports',
  PROJECTS: 'projects',
  DATABASE: 'database',
  EXPORT: 'export',
  SETTINGS: 'settings',
} as const;

export type PageType = (typeof PAGES)[keyof typeof PAGES];

export const PAGE_KEYS = Object.values(PAGES) as PageType[];
