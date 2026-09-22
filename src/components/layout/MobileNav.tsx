import { Link } from '@tanstack/react-router';
import { LayoutDashboard, FileText, Mail } from 'lucide-react';

export function MobileNav() {
  const navLinkClass = "flex flex-col items-center justify-center w-full h-full text-text-secondary hover:bg-surface-subtle hover:text-text-primary [&.active]:bg-surface-selected [&.active]:text-action-primary transition-colors";

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border-default bg-surface z-50 flex justify-around items-center h-16 pb-safe">
      <Link to="/" className={navLinkClass}>
        <LayoutDashboard className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Dashboard</span>
      </Link>
      <Link to="/applications" className={navLinkClass}>
        <FileText className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Applications</span>
      </Link>
      <Link to="/gmail" className={navLinkClass}>
        <Mail className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Gmail</span>
      </Link>
    </nav>
  );
}
