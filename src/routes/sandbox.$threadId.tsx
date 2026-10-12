import { createFileRoute } from '@tanstack/react-router';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { SandboxConversation } from '../components/sandbox/SandboxConversation';
import { SandboxShell } from '../components/sandbox/SandboxShell';

export const Route = createFileRoute('/sandbox/$threadId')({
  errorComponent: RouteErrorPage,
  component: SandboxThreadPage,
});

/** Dev mode only: one sandbox conversation. */
function SandboxThreadPage() {
  const { threadId } = Route.useParams();
  return (
    <SandboxShell active="thread">
      <SandboxConversation key={threadId} threadId={threadId} />
    </SandboxShell>
  );
}
