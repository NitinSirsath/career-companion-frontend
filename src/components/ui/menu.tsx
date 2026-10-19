import { Menu as BaseMenu } from '@base-ui/react/menu';
import { OverflowMenuVertical } from '@carbon/icons-react';
import { cn } from '../../lib/utils';
import { ITEM_CLASS, POPUP_CLASS } from './select';

export interface MenuAction {
  label: string;
  onSelect: () => void;
  /** Destructive actions read red and sit last. */
  danger?: boolean;
  disabled?: boolean;
}

interface OverflowMenuProps {
  /** What the button opens actions for, for screen readers: "Actions for Quanta Labs". */
  label: string;
  actions: readonly MenuAction[];
  size?: 'icon' | 'icon-sm';
  className?: string;
}

/** The "…" menu for a row or a page: actions that are not the main one. */
export function OverflowMenu({ label, actions, size = 'icon-sm', className }: OverflowMenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger
        aria-label={label}
        className={cn(
          'inline-flex shrink-0 cursor-pointer items-center justify-center text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover data-popup-open:bg-layer-hover',
          size === 'icon' ? 'size-10' : 'size-8',
          className,
        )}
      >
        <OverflowMenuVertical size={16} aria-hidden="true" />
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner align="end" sideOffset={4} className="z-50 outline-none">
          <BaseMenu.Popup className={cn(POPUP_CLASS, 'min-w-48')}>
            {actions.map((action) => (
              <BaseMenu.Item
                key={action.label}
                disabled={action.disabled}
                onClick={action.onSelect}
                className={cn(
                  ITEM_CLASS,
                  action.danger &&
                    'text-danger-text data-highlighted:bg-action-danger data-highlighted:text-text-inverse',
                )}
              >
                {action.label}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
