import type { ReactNode } from 'react';
import { AuthProvider } from 'react-oidc-context';
import { ToastContainer } from '@cincoders/cinnamon';
import { authProviderProps } from '../utils/auth';
import { ErrorBoundary } from '../components/ErrorBoundary';

/**
 * Único lugar onde os provedores globais da aplicação são montados. Conforme o
 * projeto cresce (tema, data-fetching, feature flags...), adicione o provider
 * aqui em vez de empilhar em `App.tsx` ou em `main.tsx`.
 *
 * Ordem, de fora para dentro:
 * 1. `ErrorBoundary` — captura qualquer erro de renderização abaixo, incluindo
 *    dentro das rotas, e mostra uma tela de erro no lugar de página em branco.
 * 2. `AuthProvider` — sessão OIDC/Keycloak, consumida via `useAuth()`.
 * 3. `ToastContainer` — destino dos `toast(...)` da cinnamon; fica fora das
 *    rotas para sobreviver à navegação.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary label="app">
      <AuthProvider {...authProviderProps}>
        {children}
        <ToastContainer toastProps={{ position: 'top-right' }} />
      </AuthProvider>
    </ErrorBoundary>
  );
}
