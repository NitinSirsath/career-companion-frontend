import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Logo } from '../layout/Logo';

/** A browser window around a picture, with its address line. */
export function Win({
  url,
  children,
  className,
  style,
}: {
  url: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn('ob-win', className)} style={style}>
      <div className="ob-win-bar">
        <i />
        <i />
        <i />
        <div className="ob-url">{url}</div>
      </div>
      {children}
    </div>
  );
}

/** The installed app's icon: the mark on black. */
export function AppIcon({
  size,
  mark,
  className,
}: {
  size: number;
  mark: number;
  className?: string;
}) {
  return (
    <i
      className={cn('ob-app-icon', className)}
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
    >
      <Logo size={mark} />
    </i>
  );
}

/** A tiny app in light or dark, for the theme cards. */
export function MiniApp({ dark }: { dark: boolean }) {
  const look = dark
    ? { bg: '#0b0b0c', side: '#111113', line: '#2e2e33', text: '#ededef' }
    : { bg: '#ffffff', side: '#f5f5f6', line: '#e1e1e5', text: '#18181b' };
  return (
    <div className="ob-mini" style={{ background: look.bg }}>
      <div className="sb" style={{ background: look.side }}>
        <i style={{ background: look.text, width: '70%' }} />
        <i style={{ background: look.line }} />
        <i style={{ background: look.line }} />
        <i style={{ background: look.line }} />
      </div>
      <div className="mn">
        <i style={{ background: look.text, width: '60%', height: 8 }} />
        <i style={{ background: look.line }} />
        <i style={{ background: look.line }} />
        <i style={{ background: look.line }} />
        <i style={{ background: look.line, width: '70%' }} />
      </div>
    </div>
  );
}
