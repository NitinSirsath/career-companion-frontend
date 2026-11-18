import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The phone's type sizes from `index.css` (owner, 18 Nov 2026) are sizes, not colours: without
 * this, `cn('text-phone-row text-text-primary')` would keep only the colour.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['phone-title', 'phone-detail', 'phone-heading', 'phone-row', 'phone-sub'] },
        { text: ['phone-label', 'phone-small'] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
