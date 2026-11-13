import { RefreshCwIcon } from 'lucide-react';
import { TopBarActions } from '../layout/Breadcrumb';
import { useRefresh } from '../ui/useRefresh';
import { CapsuleButton, GlassCapsule } from './GlassButton';

/**
 * The refresh button in a list's glass capsule (owner, 13 Nov 2026): it spins while the page is
 * fetched again. `also`: more to do first, such as asking Gmail for new mail.
 */
export function PhoneRefresh({ also }: { also?: () => unknown }) {
  const { busy, refresh } = useRefresh(also);
  return (
    <CapsuleButton
      label={busy ? 'Refreshing…' : 'Refresh'}
      aria-busy={busy || undefined}
      onClick={() => void refresh()}
    >
      <RefreshCwIcon size={22} aria-hidden="true" className={busy ? 'animate-spin' : undefined} />
    </CapsuleButton>
  );
}

/** A page's refresh alone in the top bar's capsule, on phones (laptops have their own button). */
export function PhoneRefreshCapsule({ also }: { also?: () => unknown }) {
  return (
    <TopBarActions>
      <GlassCapsule label="Page tools">
        <PhoneRefresh also={also} />
      </GlassCapsule>
    </TopBarActions>
  );
}
