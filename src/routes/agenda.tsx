import { createFileRoute } from '@tanstack/react-router';
import { Agenda } from '../components/Agenda';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';

export const Route = createFileRoute('/agenda')({
  errorComponent: RouteErrorPage,
  component: Agenda,
});
