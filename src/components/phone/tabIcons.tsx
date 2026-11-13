import type { SVGProps } from 'react';

/**
 * The tab bar's icons when their tab is on (owner, 13 Nov 2026): Lucide's shapes filled in, with
 * their inner lines cut out in the bar's colour, as iPhone tab bars show the chosen tab.
 */
type FilledProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function Filled({ size = 26, children, ...props }: FilledProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const CUT = { fill: 'none', stroke: 'var(--glass-cut)' };

export const DashboardFilled = (props: FilledProps) => (
  <Filled {...props}>
    <rect width="7" height="7" x="3" y="3" rx="1.4" />
    <rect width="7" height="7" x="14" y="3" rx="1.4" />
    <rect width="7" height="7" x="14" y="14" rx="1.4" />
    <rect width="7" height="7" x="3" y="14" rx="1.4" />
  </Filled>
);

export const MailFilled = (props: FilledProps) => (
  <Filled {...props}>
    <rect x="2" y="4" width="20" height="16" rx="2.5" />
    <path d="m21.2 7.4-8.2 5.2a2 2 0 0 1-2 0L2.8 7.4" style={CUT} />
  </Filled>
);

export const FileFilled = (props: FilledProps) => (
  <Filled {...props}>
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path d="M14 2.6v4.4a1 1 0 0 0 1 1h4.4M10 9H8M16 13H8M16 17H8" style={CUT} />
  </Filled>
);

export const SettingsFilled = (props: FilledProps) => (
  <Filled {...props}>
    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
    <circle
      cx="12"
      cy="12"
      r="3"
      style={{ fill: 'var(--glass-cut)', stroke: 'var(--glass-cut)' }}
    />
  </Filled>
);
