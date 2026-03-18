import { useState, useEffect, useCallback } from "react";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);

    let attempt = 0;
    const doFetch = (): Promise<void> =>
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
          return res.json();
        })
        .then(setData)
        .catch((err) => {
          attempt++;
          if (attempt <= MAX_RETRIES) {
            return new Promise<void>((resolve) =>
              setTimeout(() => resolve(doFetch()), RETRY_DELAY_MS * attempt)
            );
          }
          setError(err.message);
        })
        .finally(() => {
          if (attempt === 0 || attempt > MAX_RETRIES) {
            setLoading(false);
          }
        });

    doFetch();
  }, [url]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
