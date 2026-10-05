import { createFileRoute } from '@tanstack/react-router';
import { Agenda } from '../components/Agenda';
export const Route = createFileRoute('/agenda')({ component: Agenda });
