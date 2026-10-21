import { Launch } from '@carbon/icons-react';
import { safeHttpUrl } from '../../lib/safeUrl';

/**
 * A small icon that opens a job page in a new tab. Shows nothing unless the stored URL is http or
 * https. Sits above a row's own link, so it works inside a table row.
 */
export function JobLink({ url, label }: { url: string | null; label: string }) {
  const href = safeHttpUrl(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="relative z-10 inline-flex size-6 items-center justify-center text-link hover:bg-layer-hover focus-visible:outline-2 focus-visible:outline-border-focus"
    >
      <Launch size={16} aria-hidden="true" />
    </a>
  );
}
