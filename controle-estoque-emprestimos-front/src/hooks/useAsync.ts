import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook base para carregar dados assíncronos (tipicamente uma chamada de
 * serviço HTTP) e manter `data` / `isLoading` / `error` sincronizados,
 * com `reload()` para refazer a busca sob demanda.
 *
 * Existe para não repetir esse trio de estados (e o cuidado de ignorar
 * respostas de requisições já obsoletas) em cada hook de domínio — veja
 * `useTodos` para o padrão de uso: um hook por entidade, construído em
 * cima deste.
 *
 * A flag `cancelled` evita dois problemas clássicos de fetch em useEffect:
 * setState após o componente desmontar, e uma resposta antiga "vencendo"
 * uma mais nova quando `deps` muda rápido (ex: filtro digitado às pressas).
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncState<T> & {
  reload: () => void;
} {
  const [data, setData] = useState<T>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Incrementar este contador é o gatilho manual de "recarregar".
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetcher();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Erro inesperado.'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data: data as T, isLoading, error, reload };
}
