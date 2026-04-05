import { useRef, useState, useCallback } from "react";

/**
 * useApiCall — wraps a fetch function with AbortController (REL-05),
 * loading state (REL-03), and error state (REL-04).
 *
 * The `fetcher` receives an AbortSignal and must pass it to every fetch() call.
 * Calling `execute()` while a request is in-flight cancels the previous one first.
 *
 * @param fetcher - async function (signal: AbortSignal) => T; must propagate signal to fetch()
 */
export function useApiCall<T>(
  fetcher: (signal: AbortSignal) => Promise<T>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    // Cancel previous in-flight request (REL-05)
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await fetcher(controller.signal);
      if (!controller.signal.aborted) {
        setData(result);
      }
    } catch (err) {
      // AbortError means the request was intentionally cancelled — do not show error (REL-05)
      if ((err as Error).name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Erro de conexão com o servidor."
      );
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [fetcher]);

  return { loading, error, data, execute };
}
