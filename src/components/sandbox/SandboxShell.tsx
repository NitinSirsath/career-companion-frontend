import { Link } from '@tanstack/react-router';
import { PageHeader } from '../layout/PageHeader';
import type { ReactNode } from 'react';
import { useAppMode, useTestAccount } from '../../api/appMode';
import { useSandboxThreads } from '../../api/sandbox';
import { cn } from '../../lib/utils';
import { NotFoundPage } from '../errors/NotFoundPage';
import { SandboxAiKeyAlert } from './SandboxAiKeyAlert';
import { SandboxSyncBar } from './SandboxSyncBar';

export type SandboxSection = 'inbox' | 'sent' | 'compose' | 'thread';

const folderClass =
  'flex items-center justify-between px-3 py-2 text-sm text-text-primary hover:bg-layer-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
const selected = 'bg-tint text-tint-text hover:bg-tint';

/** Title, sync, the AI key warning and the folders around a sandbox page. */
function SandboxFrame({ active, children }: { active: SandboxSection; children: ReactNode }) {
  const { data } = useSandboxThreads('inbox', null);
  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Mail sandbox"
        description={`${data ? `Mailbox of ${data.mailbox}. ` : ''}A mail waits here until you sync.`}
        actions={<SandboxSyncBar notSynced={data?.notSyncedTotal ?? 0} />}
      />
      <SandboxAiKeyAlert />
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <nav aria-label="Mailbox" className="flex shrink-0 flex-col gap-1 md:w-40">
          <Link
            to="/sandbox/compose"
            className="mb-3 bg-action-primary px-3 py-2 text-center text-sm font-medium text-text-inverse hover:bg-action-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            Compose
          </Link>
          <Link
            to="/sandbox"
            search={{ folder: 'inbox' }}
            className={cn(folderClass, active === 'inbox' && selected)}
          >
            Inbox <span className="text-text-secondary">{data?.counts.inbox ?? ''}</span>
          </Link>
          <Link
            to="/sandbox"
            search={{ folder: 'sent' }}
            className={cn(folderClass, active === 'sent' && selected)}
          >
            Sent <span className="text-text-secondary">{data?.counts.sent ?? ''}</span>
          </Link>
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/**
 * Every Mail sandbox page sits in this. The sandbox exists in dev mode and for test accounts: for
 * anyone else its pages are "not found" and nothing is asked of the sandbox API.
 */
export function SandboxShell({
  active,
  children,
}: {
  active: SandboxSection;
  children: ReactNode;
}) {
  const mode = useAppMode();
  const testAccount = useTestAccount();
  if (mode === undefined || (mode !== 'dev' && testAccount === undefined)) return null;
  if (mode !== 'dev' && !testAccount) return <NotFoundPage />;
  return <SandboxFrame active={active}>{children}</SandboxFrame>;
}
