import { Link } from '@tanstack/react-router';
import {
  Calendar,
  Chemistry,
  Dashboard,
  Document,
  Email,
  Flow,
  MachineLearningModel,
  Renew,
} from '@carbon/icons-react';
import { useDevMode } from '../../api/appMode';

export function MobileNav() {
  const devMode = useDevMode();
  const navLinkClass =
    'flex flex-col items-center justify-center w-full h-full text-text-secondary hover:bg-surface-subtle hover:text-text-primary [&.active]:bg-surface-selected [&.active]:text-action-primary transition-colors';

  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border-default bg-surface z-50 flex justify-around items-center h-16 pb-safe"
    >
      <Link to="/mails" className={navLinkClass}>
        <Email size={20} className="mb-1" aria-hidden="true" />
        <span className="text-[10px] font-medium">Mails</span>
      </Link>
      <Link to="/applications" className={navLinkClass}>
        <Document size={20} className="mb-1" aria-hidden="true" />
        <span className="text-[10px] font-medium">Applications</span>
      </Link>
      <Link to="/agenda" className={navLinkClass}>
        <Calendar size={20} className="mb-1" aria-hidden="true" />
        <span className="text-[10px] font-medium">Agenda</span>
      </Link>
      <Link to="/dashboard" className={navLinkClass}>
        <Dashboard size={20} className="mb-1" aria-hidden="true" />
        <span className="text-[10px] font-medium">Dashboard</span>
      </Link>
      <Link to="/gmail" className={navLinkClass}>
        <Renew size={20} className="mb-1" aria-hidden="true" />
        <span className="text-[10px] font-medium">Gmail</span>
      </Link>
      <Link to="/ai" className={navLinkClass}>
        <MachineLearningModel size={20} className="mb-1" aria-hidden="true" />
        <span className="text-[10px] font-medium">AI</span>
      </Link>
      <Link to="/automation" className={navLinkClass}>
        <Flow size={20} className="mb-1" aria-hidden="true" />
        <span className="text-[10px] font-medium">Automation</span>
      </Link>
      {devMode && (
        <Link to="/sandbox" className={navLinkClass}>
          <Chemistry size={20} className="mb-1" aria-hidden="true" />
          <span className="text-[10px] font-medium">Sandbox</span>
        </Link>
      )}
    </nav>
  );
}
