export const REPORT_FILTERS = ['all', 'unreached', 'bounced', 'hard_bounce', 'soft_bounce', 'suppressed', 'failed', 'blocked', 'delivery_delayed', 'pending', 'unknown', 'skipped', 'sent', 'delivered', 'opened', 'clicked', 'complained'] as const;
export type ReportFilter = typeof REPORT_FILTERS[number];
