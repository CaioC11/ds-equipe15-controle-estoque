import { useCallback, useEffect, useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { emprestimoService, HttpError } from './emprestimo.service';

export const TERMO_MAX_MB = 5;

export type Feedback = { tipo: 'sucesso' | 'erro'; texto: string } | null;

function mensagemDeErro(e: unknown, fallback: string): string {
  if (e instanceof HttpError && e.status === 403) {
    return 'Apenas o gestor deste estoque pode realizar esta ação.';
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/** Estado e ações da tela do termo (#14). `estoqueId` vem de ?estoque= na URL. */
export function useTermo(estoqueId: string | null, emprestimoId: string) {
  const {
    data: emprestimo,
    isLoading,
    error,
    reload,
  } = useAsync(
    () =>
      estoqueId
        ? emprestimoService.buscarEmprestimo(estoqueId, emprestimoId)
        : Promise.reject(new Error('Estoque não informado na URL.')),
    [estoqueId, emprestimoId],
  );

  // PDF gerado pelo sistema: carregado uma vez e usado para visualizar e baixar
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [erroPdf, setErroPdf] = useState<string | null>(null);

  useEffect(() => {
    if (!estoqueId) return;
    let url: string | null = null;
    let cancelado = false;
    emprestimoService
      .obterTermoBlob(estoqueId, emprestimoId)
      .then((blob) => {
        if (cancelado) return;
        url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .catch((e) => !cancelado && setErroPdf(mensagemDeErro(e, 'Erro ao carregar o termo.')));
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [estoqueId, emprestimoId]);

  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [feedbackUpload, setFeedbackUpload] = useState<Feedback>(null);
  const [feedbackEntrega, setFeedbackEntrega] = useState<Feedback>(null);

  const anexar = useCallback(
    async (arquivo: File) => {
      if (!estoqueId) return;
      setFeedbackUpload(null);
      if (arquivo.type !== 'application/pdf') {
        return setFeedbackUpload({ tipo: 'erro', texto: 'Envie um arquivo em formato PDF.' });
      }
      if (arquivo.size > TERMO_MAX_MB * 1024 * 1024) {
        return setFeedbackUpload({ tipo: 'erro', texto: `O arquivo deve ter no máximo ${TERMO_MAX_MB} MB.` });
      }
      setEnviando(true);
      try {
        await emprestimoService.anexarTermoAssinado(estoqueId, emprestimoId, arquivo);
        setFeedbackUpload({ tipo: 'sucesso', texto: 'Termo assinado anexado com sucesso.' });
        reload();
      } catch (e) {
        setFeedbackUpload({ tipo: 'erro', texto: mensagemDeErro(e, 'Falha ao enviar o termo assinado.') });
      } finally {
        setEnviando(false);
      }
    },
    [estoqueId, emprestimoId, reload],
  );

  const confirmarEntrega = useCallback(async () => {
    if (!estoqueId) return;
    setFeedbackEntrega(null);
    setConfirmando(true);
    try {
      await emprestimoService.confirmarEntrega(estoqueId, emprestimoId);
      setFeedbackEntrega({ tipo: 'sucesso', texto: 'Entrega confirmada. O empréstimo está ativo.' });
      reload();
    } catch (e) {
      setFeedbackEntrega({ tipo: 'erro', texto: mensagemDeErro(e, 'Não foi possível confirmar a entrega.') });
    } finally {
      setConfirmando(false);
    }
  }, [estoqueId, emprestimoId, reload]);

  const baixarAssinado = useCallback(async () => {
    if (!estoqueId) return;
    try {
      const blob = await emprestimoService.obterTermoAssinadoBlob(estoqueId, emprestimoId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `termo-emprestimo-${emprestimoId}-assinado.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFeedbackUpload({ tipo: 'erro', texto: mensagemDeErro(e, 'Erro ao baixar o termo assinado.') });
    }
  }, [estoqueId, emprestimoId]);

  return {
    emprestimo,
    isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    pdfUrl,
    erroPdf,
    enviando,
    confirmando,
    feedbackUpload,
    feedbackEntrega,
    anexar,
    confirmarEntrega,
    baixarAssinado,
  };
}