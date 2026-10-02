/** Automation submissions (ADR-0002): reported by the user's own tool, never AI output. */
export const AUTOMATION_SUBMITTED = 'AUTOMATION_SUBMITTED';

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  naukri: 'Naukri',
  wellfound: 'Wellfound',
  instahyre: 'Instahyre',
  workday: 'Workday',
  company_direct: 'Company site',
  discovery: 'Discovery',
};

export const platformLabel = (platform: string) => PLATFORM_LABEL[platform] ?? platform;

/** Human label for a timeline event type, shared by the list and detail pages. */
export function eventLabel(type: string): string {
  if (type === AUTOMATION_SUBMITTED) return 'Submitted via automation';
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}
