import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

/** A page that is in the menu but not built yet: says what will be there, and leads to Mails. */
export function ComingSoon({
  title,
  heading,
  children,
}: {
  title: string;
  heading: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <section className="flex min-h-96 flex-col items-center justify-center gap-3 border border-border-default bg-surface-subtle px-6 py-12 text-center">
        <Badge variant="secondary">Coming soon</Badge>
        <h2 className="text-xl font-semibold">{heading}</h2>
        <p className="max-w-lg text-sm text-text-secondary">{children}</p>
        <Button className="mt-2" onClick={() => void navigate({ to: '/mails' })}>
          Open Mails
        </Button>
      </section>
    </div>
  );
}
