import { useEffect, useState } from 'react';

/** The widest phone: Tailwind's `md` starts at 768px. */
const PHONE_MAX_WIDTH = 767;

const phoneWidth = () => typeof window !== 'undefined' && window.innerWidth <= PHONE_MAX_WIDTH;

/**
 * True on a phone-sized window, where the app uses its phone layout (rows instead of tables, the
 * menu drawer). Follows the window as it is resized.
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(phoneWidth);
  useEffect(() => {
    const change = () => setPhone(phoneWidth());
    window.addEventListener('resize', change);
    return () => window.removeEventListener('resize', change);
  }, []);
  return phone;
}
