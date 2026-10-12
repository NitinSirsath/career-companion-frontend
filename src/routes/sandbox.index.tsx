import { createFileRoute } from '@tanstack/react-router';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { SandboxShell } from '../components/sandbox/SandboxShell';
import { SandboxThreadList } from '../components/sandbox/SandboxThreadList';
import { sandboxSearchSchema } from '../lib/sandbox';

export const Route = createFileRoute('/sandbox/')({
  errorComponent: RouteErrorPage,
  validateSearch: sandboxSearchSchema,
  component: SandboxFolderPage,
});

/** Dev mode only: the sandbox mailbox, Inbox or Sent. */
function SandboxFolderPage() {
  const folder = Route.useSearch().folder ?? 'inbox';
  return (
    <SandboxShell active={folder}>
      {/* A new list per folder, so its page position starts again. */}
      <SandboxThreadList key={folder} folder={folder} />
    </SandboxShell>
  );
}
