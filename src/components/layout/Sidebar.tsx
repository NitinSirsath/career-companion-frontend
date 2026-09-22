import { Link } from '@tanstack/react-router';
import { LayoutDashboard, FileText, Mail, LogOut, Briefcase } from 'lucide-react';
import { logout } from '../../api/auth';
import { ThemeSelector } from '../ThemeSelector';

export function Sidebar() {
  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const navLinkClass = "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-none text-text-secondary border-l-2 border-transparent hover:bg-surface-subtle hover:text-text-primary [&.active]:bg-surface-selected [&.active]:text-text-primary [&.active]:font-semibold [&.active]:border-border-focus transition-colors";

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border-default bg-surface h-screen sticky top-0">
      <div className="p-4 border-b border-border-default flex items-center gap-3">
        <Briefcase className="w-6 h-6 text-action-primary" />
        <h1 className="font-semibold text-lg tracking-tight">Career Companion</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <Link to="/" className={navLinkClass}>
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Link>
        <Link to="/applications" className={navLinkClass}>
          <FileText className="w-4 h-4" />
          Applications
        </Link>
        <Link to="/gmail" className={navLinkClass}>
          <Mail className="w-4 h-4" />
          Gmail Sync
        </Link>
      </nav>
      
      <div className="p-4 border-t border-border-default flex flex-col gap-4">
        <ThemeSelector />
        
        <div className="border-t border-border-subtle pt-4">
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-none text-status-error hover:bg-status-error-subtle transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
