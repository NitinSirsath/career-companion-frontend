import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** The same time and curve as `duration-240 ease-standard`. */
const MOTION = { duration: 240, easing: 'cubic-bezier(0.2, 0, 0.38, 0.9)' };

/** True while a part inside already animates its own height, as an opening Collapse does. */
function contentIsMoving(content: HTMLElement): boolean {
  return content.getAnimations({ subtree: true }).some((animation) => {
    if (animation.playState !== 'running') return false;
    const keyframes = (animation.effect as KeyframeEffect | null)?.getKeyframes() ?? [];
    return keyframes.some((frame) => 'height' in frame || 'gridTemplateRows' in frame);
  });
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A box that follows its content's height smoothly: when the content jumps taller or shorter
 * (new results, the next step), the box moves to the new height over 240ms instead of in one
 * frame. A part inside that already animates its own height is followed as it moves, so the two
 * never fight.
 */
export function AutoHeight({
  className,
  contentClassName,
  children,
}: {
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = box.current;
    const inner = content.current;
    // Test pages have no layout or animations: the box simply stays as tall as its content.
    if (!outer || !inner || typeof ResizeObserver === 'undefined' || !outer.animate) return;
    let last = inner.offsetHeight;
    let running: Animation | null = null;
    const observer = new ResizeObserver(() => {
      const next = inner.offsetHeight;
      if (next === last) return;
      const from = running ? outer.getBoundingClientRect().height : last;
      last = next;
      running?.cancel();
      running = null;
      outer.style.overflow = '';
      if (contentIsMoving(inner) || reducedMotion()) return;
      const animation = outer.animate([{ height: `${from}px` }, { height: `${next}px` }], MOTION);
      outer.style.overflow = 'hidden';
      running = animation;
      animation.onfinish = () => {
        if (running !== animation) return;
        running = null;
        outer.style.overflow = '';
      };
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      running?.cancel();
    };
  }, []);

  return (
    <div ref={box} className={cn('shrink-0', className)}>
      <div ref={content} className={contentClassName}>
        {children}
      </div>
    </div>
  );
}
