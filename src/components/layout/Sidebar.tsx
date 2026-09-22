import { Link } from '@tanstack/react-router';
import { LayoutDashboard, FileText, Mail, LogOut, Briefcase } from 'lucide-react';
import { logout } from '../../api/auth';

export function Sidebar() {
  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card h-screen sticky top-0">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Briefcase className="w-6 h-6 text-primary" />
        <h1 className="font-semibold text-lg tracking-tight">Career Companion</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <Link 
          to="/" 
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-none text-muted-foreground hover:bg-surface-2 hover:text-foreground [&.active]:bg-surface-2 [&.active]:text-foreground [&.active]:font-semibold transition-colors"
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Link>
        <Link 
          to="/applications" 
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-none text-muted-foreground hover:bg-surface-2 hover:text-foreground [&.active]:bg-surface-2 [&.active]:text-foreground [&.active]:font-semibold transition-colors"
        >
          <FileText className="w-4 h-4" />
          Applications
        </Link>
        <Link 
          to="/gmail" 
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-none text-muted-foreground hover:bg-surface-2 hover:text-foreground [&.active]:bg-surface-2 [&.active]:text-foreground [&.active]:font-semibold transition-colors"
        >
          <Mail className="w-4 h-4" />
          Gmail Sync
        </Link>
      </nav>
      
      <div className="p-4 border-t border-border">
        <button 
          onClick={handleLogout} 
          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-none text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
