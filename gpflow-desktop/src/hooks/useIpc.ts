'use client';

import { useState, useCallback } from 'react';

export function useIpc<TArgs extends any[], TResult>(
  fn: ((...args: TArgs) => Promise<TResult>) | undefined,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (...args: TArgs): Promise<TResult | null> => {
    if (!fn) {
      setError('Not running in Electron');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [fn]);

  return { execute, loading, error };
}
