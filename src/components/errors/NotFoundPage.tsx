import { useRouter } from '@tanstack/react-router';
import { ErrorState } from './ErrorState';

export function NotFoundPage() {
  const router = useRouter();

  return (
    <ErrorState
      title="Page not found"
      message="The page you requested does not exist or is no longer available."
      showDashboard
      onDashboard={() => void router.navigate({ to: '/' })}
    />
  );
}
