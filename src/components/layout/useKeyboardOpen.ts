import { useSyncExternalStore } from 'react';

/** How much shorter the visible screen must get to count as the keyboard, not the browser's bars. */
const KEYBOARD_MIN_HEIGHT = 60;

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener('resize', onChange);
  return () => viewport?.removeEventListener('resize', onChange);
}

function keyboardOpen() {
  const viewport = window.visualViewport;
  // A pinch zoom also makes the visible part shorter: only an unzoomed page counts.
  return (
    !!viewport && viewport.scale === 1 && window.innerHeight - viewport.height > KEYBOARD_MIN_HEIGHT
  );
}

/**
 * True while the phone's on-screen keyboard is up. A field can have the focus without it (the
 * reply's text when the sheet opens), so the focus alone does not say the user is typing.
 */
export function useKeyboardOpen() {
  return useSyncExternalStore(subscribe, keyboardOpen, () => false);
}
