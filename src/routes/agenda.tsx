import { createFileRoute } from '@tanstack/react-router';
import { ComingSoon } from '../components/ComingSoon';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';

export const Route = createFileRoute('/agenda')({
  errorComponent: RouteErrorPage,
  component: AgendaPage,
});

/** Not built yet. The earlier page (`components/Agenda.tsx`) stays in the repo, shown nowhere. */
function AgendaPage() {
  return (
    <ComingSoon title="Agenda" heading="Your interviews and deadlines by date">
      This page will list your interviews and assessment dates in one place. Until then, each date
      is shown on its mail, on the Mails page.
    </ComingSoon>
  );
}
