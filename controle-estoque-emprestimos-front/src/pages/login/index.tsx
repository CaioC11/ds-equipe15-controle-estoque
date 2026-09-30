import { Text } from '@cincoders/cinnamon';
import { LogIn } from 'lucide-react';
import type { AuthContextProps } from 'react-oidc-context';
import cinLogo from '../../assets/icons/cin-logo.svg';

interface LoginPageProps {
  auth: AuthContextProps;
}

export default function LoginPage({ auth }: LoginPageProps) {
  const handleLogin = () => {
    auth.signinRedirect();
  };

  const isActionDisabled = auth.isLoading || auth.activeNavigator !== undefined;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-800 dark:bg-gray-900 text-center">
        <div className="flex justify-center">
          <img
            src={cinLogo}
            alt="CIn UFPE Logo"
            className="h-16 w-auto dark:invert"
          />
        </div>
        <div>
          <Text as="h2" variant="title">
            {'Controle de Estoque e Empréstimos'}
          </Text>
          <Text as="p" variant="description">
            Acesse com sua conta institucional do CIn para continuar.
          </Text>
        </div>

        {auth.error && (
          <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/40">
            <Text variant="alarm" className="mt-0 text-red-700 dark:text-red-400">
              Ocorreu um erro ao tentar autenticar: {auth.error.message}
            </Text>
          </div>
        )}

        <div className="mt-8">
          <button
            type="button"
            onClick={handleLogin}
            disabled={isActionDisabled}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 shadow-sm transition hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:focus:ring-offset-gray-900 cursor-pointer disabled:cursor-not-allowed"
          >
            <LogIn className="h-5 w-5 text-white" />
            <span className="text-base font-medium text-white">Entrar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
