import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { accessCopy } from '../../lib/aiLabels';

/** Shown wherever waiting emails matter, while the user's AI access is not ready. */
export function AIAccessNotice() {
  const { data } = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  const copy = data ? accessCopy(data) : null;
  if (!copy) return null;
  return (
    <section
      role="status"
      aria-label="AI status"
      className="border border-status-warning bg-status-warning-subtle p-4 space-y-1"
    >
      <p className="font-medium">{copy.title}</p>
      <p className="text-sm">{copy.detail}</p>
      <p className="flex flex-wrap gap-4 text-sm">
        {copy.fix?.href && (
          <a className="underline" href={copy.fix.href} target="_blank" rel="noopener noreferrer">
            {copy.fix.label}
          </a>
        )}
        <Link to="/ai" className="underline">
          {copy.fix?.to ? copy.fix.label : 'AI provider settings'}
        </Link>
      </p>
    </section>
  );
}
