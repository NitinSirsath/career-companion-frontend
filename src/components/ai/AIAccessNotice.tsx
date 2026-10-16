import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Button } from '../ui/button';
import { useWaitingNotice } from './useWaitingNotice';

/** `text` with its first `strong` part in bold, as "Google answered **503 UNAVAILABLE** at …". */
export function Emphasized({ text, strong }: { text: string; strong?: string }) {
  const at = strong ? text.indexOf(strong) : -1;
  if (!strong || at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <strong>{strong}</strong>
      {text.slice(at + strong.length)}
    </>
  );
}

/** Shown wherever waiting emails matter, while the user's AI access is not ready. */
export function AIAccessNotice() {
  const { data } = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  const { notice, read, failed, sendsTest } = useWaitingNotice(data);
  if (!notice) return null;
  return (
    <section
      role="status"
      aria-label="AI status"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border border-status-warning bg-status-warning-subtle p-4"
    >
      <div className="min-w-0 flex-1 basis-80 space-y-1">
        <p className="font-semibold">{notice.title}</p>
        <p className="text-sm leading-normal">
          <Emphasized text={notice.detail} strong={notice.strong} />
        </p>
        {notice.hint && <p className="text-sm leading-normal">{notice.hint}</p>}
        {notice.notes.map((note) => (
          <p key={note} className="text-sm leading-normal">
            {note}
          </p>
        ))}
        {failed && <p className="text-sm">The new try could not be started. Try again.</p>}
        <p className="flex flex-wrap gap-4 text-sm">
          {notice.fix?.href && (
            <a
              className="underline"
              href={notice.fix.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {notice.fix.label}
              <span aria-hidden="true"> ↗</span>
            </a>
          )}
          <Link to="/ai" className="underline">
            {notice.fix?.to ? notice.fix.label : 'AI provider settings'}
          </Link>
        </p>
      </div>
      {notice.button !== 'none' && (
        <div className="flex flex-col items-end gap-1.5">
          <Button type="button" disabled={notice.button === 'trying'} onClick={read}>
            {notice.button === 'trying' ? 'Trying now…' : 'Read waiting mails now'}
          </Button>
          {sendsTest && (
            <span className="text-xs text-text-secondary">Sends 1 mail first, as a test.</span>
          )}
        </div>
      )}
    </section>
  );
}
