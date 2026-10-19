import * as React from 'react';
import { cn } from '../../lib/utils';
import { Spinner } from './spinner';

export type ButtonVariant =
  'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'danger-ghost';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** "icon" and "icon-sm" are square buttons for a single icon; give them an aria-label. */
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm';
  /** Shows a spinner and blocks clicks. Put the busy wording ("Sending…") in the children. */
  loading?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-action-primary text-text-inverse hover:bg-action-primary-hover',
  secondary: 'bg-button-secondary text-text-inverse hover:bg-button-secondary-hover',
  tertiary:
    'border-button-tertiary text-button-tertiary hover:bg-button-tertiary hover:text-button-tertiary-hover-text disabled:border-text-disabled disabled:bg-transparent',
  ghost: 'text-link hover:bg-layer-hover disabled:bg-transparent',
  danger: 'bg-action-danger text-text-inverse hover:bg-action-danger-hover',
  'danger-ghost':
    'text-danger-text hover:bg-action-danger hover:text-text-inverse disabled:bg-transparent',
};

const SIZES = {
  default: 'h-10 px-4',
  sm: 'h-8 px-3',
  lg: 'h-12 px-4',
  icon: 'size-10 justify-center',
  'icon-sm': 'size-8 justify-center',
} as const;

/** IBM Carbon button. One primary button per page or panel; the rest are secondary or quieter. */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'default',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const iconOnly = size === 'icon' || size === 'icon-sm';
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border border-transparent text-sm leading-[18px] tracking-[0.16px] transition-colors duration-70 ease-standard',
          'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-disabled disabled:text-text-disabled',
          VARIANTS[variant],
          iconOnly && variant === 'ghost' && 'text-text-primary',
          SIZES[size],
          className,
        )}
        {...props}
      >
        {children}
        {loading && <Spinner />}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button };
