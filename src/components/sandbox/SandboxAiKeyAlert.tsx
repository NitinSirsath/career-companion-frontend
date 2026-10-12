import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api } from '../../api/client';

/** Said loudly, because nothing is ever filled in for the AI: with no key, mail is not read. */
export function SandboxAiKeyAlert() {
  const { data } = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  if (data?.access.state !== 'NOT_SET_UP') return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-2 border-status-error bg-status-error-subtle p-4"
    >
      <div>
        <p className="font-semibold text-status-error">AI key is not set up</p>
        <p className="text-sm">
          Mails are synced but not read. Add your key, then the waiting mails are read.
        </p>
      </div>
      <Link
        to="/ai"
        className="bg-action-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-action-primary-hover"
      >
        Set up AI provider
      </Link>
    </div>
  );
}
