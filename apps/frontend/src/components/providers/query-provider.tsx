'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * No cache. Every mount refetches from the API.
 *
 * The previous configuration held results for 60s (`staleTime`), which meant a
 * mutation on one screen was invisible on the next until the window expired —
 * posts that had just been created did not appear, unread counts stayed stale
 * after marking as read, and admin edits seemed not to save. Fresh fetching is
 * cheap here and the correctness is worth it.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            gcTime: 0,
            refetchOnMount: 'always',
            refetchOnReconnect: true,
            retry: 1,
          },
          mutations: { retry: 0 },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
