import { Link } from '@tanstack/react-router';
import { LayoutDashboard, FileText, Mail } from 'lucide-react';

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card z-50 flex justify-around items-center h-16 pb-safe">
      <Link 
        to="/" 
        className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-foreground [&.active]:text-primary"
      >
        <LayoutDashboard className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Dashboard</span>
      </Link>
      <Link 
        to="/applications" 
        className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-foreground [&.active]:text-primary"
      >
        <FileText className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Applications</span>
      </Link>
      <Link 
        to="/gmail" 
        className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-foreground [&.active]:text-primary"
      >
        <Mail className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Gmail</span>
      </Link>
      {/* For simplicity, Logout/More can just be a button or link here, or we omit for now and put it in a top bar on mobile */}
    </nav>
  );
}
