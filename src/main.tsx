import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { getCurrentUser } from './api/auth';

const queryClient = new QueryClient()

function App() {
  const [loading, setLoading] = useState(true);
  // Router is created once after user fetch; using any avoids complex generic inference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [router, setRouter] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then((u) => {
      const r = createRouter({
        routeTree,
        context: { user: u },
      });
      setRouter(r);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return <RouterProvider router={router} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
