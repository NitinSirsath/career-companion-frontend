import { cn } from '../../lib/utils';

/** The mark at 24px and up: a half sun over three list lines. */
const LARGE =
  'M2 16A14 14 0 0 1 30 16ZM2.081 17.5H24.5A1.5 1.5 0 0 1 24.5 20.5H2.743A14 14 0 0 1 2.081 17.5ZM3.351 22H19.5A1.5 1.5 0 0 1 19.5 25H5.276A14 14 0 0 1 3.351 22ZM6.74 26.5H15A1.5 1.5 0 0 1 15 29.5H12.292A14 14 0 0 1 6.74 26.5Z';

/** The mark under 24px: two thicker lines, so they do not blur. */
const SMALL =
  'M2 16A14 14 0 0 1 30 16ZM2.144 18H22A2 2 0 0 1 22 22H3.351A14 14 0 0 1 2.144 18ZM4.511 24H15.5A2 2 0 0 1 15.5 28H8.789A14 14 0 0 1 4.511 24Z';

/**
 * The app's mark, the Horizon: a half sun over a list. Used alone where the name does not fit;
 * never next to `Wordmark`, which already draws it as its "o".
 */
export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="2 2 28 28"
      aria-hidden="true"
      className={cn('shrink-0 fill-border-interactive', className)}
    >
      <path d={size < 24 ? SMALL : LARGE} />
    </svg>
  );
}

/**
 * The name as the logo: "northlist" in bold, with the mark as its "o". Its size is the font size
 * in pixels; under 28px the "o" is the small mark. Screen readers hear "NorthList".
 */
export function Wordmark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="NorthList"
      style={{ fontSize: size }}
      className={cn(
        'inline-block leading-none font-bold tracking-[-0.045em] whitespace-nowrap text-text-primary',
        className,
      )}
    >
      <span aria-hidden="true">n</span>
      <svg
        viewBox="2 2 28 28"
        aria-hidden="true"
        className="-mr-[0.031em] ml-[0.011em] inline-block size-[0.57em] fill-border-interactive align-[-0.017em]"
      >
        <path d={size < 28 ? SMALL : LARGE} />
      </svg>
      <span aria-hidden="true">rthlist</span>
    </span>
  );
}
