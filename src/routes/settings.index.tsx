import { createFileRoute } from '@tanstack/react-router';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { SettingsTab } from '../components/phone/SettingsTab';

/** The phone's Settings tab; laptops reach the same pages from the side menu. */
export const Route = createFileRoute('/settings/')({
  errorComponent: RouteErrorPage,
  component: SettingsTab,
});
