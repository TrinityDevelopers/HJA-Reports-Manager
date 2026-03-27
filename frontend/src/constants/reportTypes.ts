export const REPORT_TYPES = {
  DIGITAL_DENSITY: 'digital-density',
} as const;

export type ReportType = (typeof REPORT_TYPES)[keyof typeof REPORT_TYPES];

export const REPORT_TYPE_VALUES = Object.values(REPORT_TYPES) as ReportType[];
