import { RefreshCwIcon } from 'lucide-react';
import { Button } from './button';
import { useRefresh } from './useRefresh';

/**
 * The refresh button on laptop list pages that had none (owner, 13 Nov 2026): Dashboard and
 * NorthList Apply, drawn like the Applications page's own. Nobody has to reload the app.
 */
export function RefreshButton() {
  const { busy, refresh } = useRefresh();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={busy ? 'Refreshing…' : 'Refresh'}
      title="Refresh"
      loading={busy}
      onClick={() => void refresh()}
    >
      {!busy && <RefreshCwIcon size={16} aria-hidden="true" />}
    </Button>
  );
}
