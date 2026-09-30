import { env } from '../config/env';

export const API_URL = env.apiUrl;

// Cliente HTTP único (baseado em fetch). O token de auth e o refresh de 401
// ficam centralizados aqui — não há mais um segundo cliente (axios).
let authToken: string | null = null;

// Expiração (epoch ms) do token atual, lida do próprio JWT. 0 = desconhecida.
let tokenExpiresAt = 0;

// Margem para latência de rede e diferença de relógio entre browser e servidor:
// um token que expira "daqui a 2s" já deve ser renovado antes de sair daqui.
const EXPIRY_SKEW_MS = 5000;

/**
 * Lê `exp` do JWT sem validar assinatura (quem valida é o backend). Serve só
 * para sabermos se vale a pena enviar o token ou renová-lo antes.
 */
const readTokenExpiry = (token: string): number => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(normalized)) as { exp?: number };
    return typeof claims.exp === 'number' ? claims.exp * 1000 : 0;
  } catch {
    return 0;
  }
};

export const setAuthToken = (token: string | null) => {
  authToken = token;
  tokenExpiresAt = token ? readTokenExpiry(token) : 0;
};

// Exposto para o uploader baseado em XMLHttpRequest (progresso real de upload),
// que não passa pelo fetchApi mas precisa do mesmo token de autenticação.
export const getAuthToken = () => authToken;

export let refreshTokenFn: (() => Promise<string | null>) | null = null;

export const setRefreshTokenFn = (fn: (() => Promise<string | null>) | null) => {
  refreshTokenFn = fn;
};

// Acionado quando uma chamada autenticada segue negada mesmo após tentar
// renovar o token — a sessão morreu (expirada/revogada), então deslogamos.
let logoutFn: (() => void) | null = null;

export const setLogoutFn = (fn: (() => void) | null) => {
  logoutFn = fn;
};

const isTokenExpired = () =>
  tokenExpiresAt > 0 && Date.now() >= tokenExpiresAt - EXPIRY_SKEW_MS;

// Renovação em voo, compartilhada. No load da página várias telas disparam
// requisições em paralelo; sem isto cada uma abriria seu próprio signinSilent.
let inFlightRefresh: Promise<string | null> | null = null;

const refreshOnce = (): Promise<string | null> => {
  if (!refreshTokenFn) return Promise.resolve(null);

  if (!inFlightRefresh) {
    inFlightRefresh = refreshTokenFn().finally(() => {
      inFlightRefresh = null;
    });
  }

  return inFlightRefresh;
};

/**
 * Garante um token válido antes de uma requisição.
 *
 * O token vem persistido pelo `react-oidc-context` e é restaurado no load da
 * página; como o access token do Keycloak vive poucos minutos, no primeiro
 * fetch depois de abrir/recarregar a aplicação ele costuma já estar expirado.
 * Sem esta checagem a requisição saía com o token velho, o backend respondia
 * 401 e só então renovávamos — de onde vinha o "a primeira chamada sempre
 * falha". Renovar antes elimina o 401 em vez de reagir a ele.
 */
export const ensureFreshToken = async (): Promise<string | null> => {
  if (authToken && isTokenExpired()) {
    try {
      await refreshOnce();
    } catch (e) {
      console.error('fetchApi: falha ao renovar token proativamente:', e);
    }
  }
  return authToken;
};

export const fetchApi = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = await ensureFreshToken();

  let headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(input, { ...init, headers });

  // Rede de segurança: o token pode ter sido revogado no servidor, ou o relógio
  // local estar adiantado. Mantemos o retry reativo.
  if (response.status === 401) {
    let newToken: string | null = null;
    if (refreshTokenFn) {
      try {
        newToken = await refreshOnce();
      } catch (e) {
        console.error('fetchApi silent renew error:', e);
      }
    }

    if (newToken) {
      headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(input, { ...init, headers });
    } else {
      // Sessão morta: sem token novo para tentar de novo. Desloga o usuário.
      logoutFn?.();
    }
  }

  return response;
};

/**
 * Extrai a mensagem de erro real do corpo de uma resposta HTTP com falha
 * (formato do NestJS: { message: string | string[] }), com fallback para
 * texto puro ou uma mensagem padrão.
 */
export const getApiErrorMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const data = await response.clone().json();
    const msg = data?.message ?? data?.error;
    if (Array.isArray(msg)) return msg.filter(Boolean).join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;
  } catch {
    // corpo não é JSON — tenta como texto abaixo
  }

  try {
    const text = await response.text();
    if (text && text.trim()) return text;
  } catch {
    // ignora
  }

  return fallback;
};
