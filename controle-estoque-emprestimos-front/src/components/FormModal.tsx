import { useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Text } from '@cincoders/cinnamon';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  title: string;
  titleVariant?: React.ComponentProps<typeof Text>['variant'];
  isSubmitting: boolean;
  submitLabel: string;
  /** Largura do popup — modais com mais campos (ex: grid de 3 colunas) precisam de mais espaço. */
  size?: 'md' | 'lg';
  children: React.ReactNode;
}

/**
 * Casca compartilhada dos modais de formulário (overlay + fechar ao clicar
 * fora + header com título/X + footer com Cancelar/Submit). Extraída de
 * `MemberModal` e `TodoModal`, que só diferem nos campos do corpo.
 */
export function FormModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  titleVariant = 'announce',
  isSubmitting,
  submitLabel,
  size = 'md',
  children,
}: FormModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Popups do SimpleSelect (e outros overlays do Base UI) são renderizados
    // via portal fora de contentRef, então um clique neles conta como "fora"
    // do modal a menos que a gente também os exclua explicitamente aqui.
    if (target.closest('[data-slot="select-content"]')) return;
    if (!contentRef.current?.contains(target)) {
      onClose();
    }
  };

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in-0 duration-200"
    >
      <div
        ref={contentRef}
        className={`w-full ${size === 'lg' ? 'max-w-lg' : 'max-w-md'} rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900 animate-in fade-in-0 zoom-in-95 duration-200`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <Text variant={titleVariant}>{title}</Text>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          {children}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
