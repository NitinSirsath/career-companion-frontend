import * as React from 'react';
import {
  CheckmarkFilled,
  ErrorFilled,
  InformationFilled,
  WarningAltFilled,
  type CarbonIconType,
} from '@carbon/icons-react';
import { cn } from '../../lib/utils';

type Kind = 'info' | 'success' | 'warning' | 'error';

const LOOK: Record<Kind, { box: string; icon: string; Icon: CarbonIconType }> = {
  info: { box: 'bg-notice-info', icon: 'text-link', Icon: InformationFilled },
  success: { box: 'bg-notice-success', icon: 'text-ok', Icon: CheckmarkFilled },
  warning: { box: 'bg-notice-warning', icon: 'text-warning-icon', Icon: WarningAltFilled },
  error: { box: 'bg-notice-error', icon: 'text-danger-text', Icon: ErrorFilled },
};

interface InlineNotificationProps {
  kind?: Kind;
  /** One bold sentence: what happened. */
  title?: string;
  children?: React.ReactNode;
  /** One small action, such as "Try again". */
  action?: React.ReactNode;
  className?: string;
}

/** A short notice inside a page. Errors announce themselves to screen readers. */
export function InlineNotification({
  kind = 'info',
  title,
  children,
  action,
  className,
}: InlineNotificationProps) {
  const { box, icon, Icon } = LOOK[kind];
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn('flex animate-open items-start gap-3 px-4 py-3 text-sm', box, className)}
    >
      <Icon size={16} aria-hidden="true" className={cn('mt-0.5 shrink-0', icon)} />
      <div className="min-w-0 flex-1">
        {title && <span className="font-semibold">{title} </span>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
