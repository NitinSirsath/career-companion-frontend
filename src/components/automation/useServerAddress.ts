import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

/**
 * Where NorthList Apply reaches this backend: the backend's own public address when it has one (on
 * Render the page and the backend differ); locally this page passes /mcp on, so its own address
 * works. Null until the answer is in, so a wrong address never flashes up.
 */
export function useServerAddress(): string | null {
  const connection = useQuery({
    queryKey: ['mcp-connection'],
    queryFn: ({ signal }) => api.getMcpConnection({ signal }),
    staleTime: Infinity,
  });
  if (connection.isPending) return null;
  return connection.data?.serverAddress ?? window.location.origin;
}
