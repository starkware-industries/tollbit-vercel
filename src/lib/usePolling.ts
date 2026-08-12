import { useCallback, useEffect, useState } from 'react';

export const DEFAULT_POLL_INTERVAL_MS = 3000;

export function usePolling<T>(
  load: () => Promise<T>,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
): { data: T | null; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    load()
      .then((next) => {
        setData(next);
        setError(null);
      })
      .catch((cause: Error) => setError(cause.message));
  }, [load]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}
