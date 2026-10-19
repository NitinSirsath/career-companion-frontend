import { Link } from '@tanstack/react-router';
import {
  Calendar,
  Chemistry,
  Dashboard,
  Document,
  Email,
  Flow,
  Logout,
  MachineLearningModel,
  Portfolio,
  Renew,
  User,
} from '@carbon/icons-react';
import { useDevMode } from '../../api/appMode';
import { logout } from '../../api/auth';
import { ThemeSelector } from '../ThemeSelector';

export function Sidebar() {
  const devMode = useDevMode();
  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const navLinkClass =
    'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-none text-text-secondary border-l-2 border-transparent hover:bg-surface-subtle hover:text-text-primary [&.active]:bg-surface-selected [&.active]:text-text-primary [&.active]:font-semibold [&.active]:border-border-focus transition-colors';

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border-default bg-surface h-screen sticky top-0">
      <div className="p-4 border-b border-border-default flex items-center gap-3">
        <Portfolio size={24} className="text-action-primary" aria-hidden="true" />
        <div className="font-semibold text-lg tracking-tight">Career Companion</div>
      </div>

      <nav aria-label="Main" className="flex-1 p-4 space-y-1 overflow-y-auto">
        <Link to="/mails" className={navLinkClass}>
          <Email size={16} aria-hidden="true" />
          Mails
        </Link>
        <Link to="/applications" className={navLinkClass}>
          <Document size={16} aria-hidden="true" />
          Applications
        </Link>
        <Link to="/agenda" className={navLinkClass}>
          <Calendar size={16} aria-hidden="true" />
          Agenda
        </Link>
        <Link to="/dashboard" className={navLinkClass}>
          <Dashboard size={16} aria-hidden="true" />
          Dashboard
        </Link>
        <Link to="/gmail" className={navLinkClass}>
          <Renew size={16} aria-hidden="true" />
          Gmail Sync
        </Link>
        <Link to="/ai" className={navLinkClass}>
          <MachineLearningModel size={16} aria-hidden="true" />
          AI Provider
        </Link>
        <Link to="/automation" className={navLinkClass}>
          <Flow size={16} aria-hidden="true" />
          Automation
        </Link>
        {devMode && (
          <Link to="/sandbox" className={navLinkClass}>
            <Chemistry size={16} aria-hidden="true" />
            Mail sandbox
            <span className="ml-auto bg-status-warning-subtle px-1.5 text-[10px] font-semibold text-status-warning">
              DEV
            </span>
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-border-default flex flex-col gap-4">
        <ThemeSelector />

        <div className="border-t border-border-subtle pt-4 space-y-1">
          <Link to="/account" className={navLinkClass}>
            <User size={16} aria-hidden="true" />
            Account
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-none text-status-error hover:bg-status-error-subtle transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
          >
            <Logout size={16} aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
