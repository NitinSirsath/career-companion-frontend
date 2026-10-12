import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSandboxThreads } from '../api/sandbox';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { SandboxComposeForm } from '../components/sandbox/SandboxComposeForm';
import { SandboxShell } from '../components/sandbox/SandboxShell';

export const Route = createFileRoute('/sandbox/compose')({
  errorComponent: RouteErrorPage,
  component: SandboxComposePage,
});

/** The form needs the mailbox address, which the sandbox knows. */
function Compose() {
  const navigate = useNavigate();
  const { data } = useSandboxThreads('inbox', null);
  const toInbox = () => void navigate({ to: '/sandbox', search: { folder: 'inbox' } });
  if (!data) return null;
  return <SandboxComposeForm mailbox={data.mailbox} onSent={toInbox} onDiscard={toInbox} />;
}

/** Dev mode only: write a new mail to yourself from any address. */
function SandboxComposePage() {
  return (
    <SandboxShell active="compose">
      <Compose />
    </SandboxShell>
  );
}
