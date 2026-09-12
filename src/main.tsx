import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { getCurrentUser, User } from './api/auth';

const queryClient = new QueryClient()

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [router, setRouter] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      
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
