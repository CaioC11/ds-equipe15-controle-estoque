import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  fetchApi,
  getApiErrorMessage,
  setAuthToken,
  setRefreshTokenFn,
} from './api'

describe('getApiErrorMessage', () => {
  it('extrai message string do corpo JSON (formato NestJS)', async () => {
    const res = new Response(JSON.stringify({ message: 'Campanha não encontrada' }), {
      status: 400,
    })
    expect(await getApiErrorMessage(res, 'fallback')).toBe('Campanha não encontrada')
  })

  it('junta message em array (erros de validação)', async () => {
    const res = new Response(
      JSON.stringify({ message: ['title vazio', 'data inválida'] }),
      { status: 400 },
    )
    expect(await getApiErrorMessage(res, 'fallback')).toBe('title vazio, data inválida')
  })

  it('cai para texto puro quando o corpo não é JSON', async () => {
    const res = new Response('erro cru', { status: 500 })
    expect(await getApiErrorMessage(res, 'fallback')).toBe('erro cru')
  })

  it('usa o fallback quando o corpo está vazio', async () => {
    const res = new Response('', { status: 500 })
    expect(await getApiErrorMessage(res, 'fallback')).toBe('fallback')
  })
})

describe('fetchApi', () => {
  beforeEach(() => {
    setAuthToken(null)
    setRefreshTokenFn(null)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('anexa o token Bearer quando definido', async () => {
    setAuthToken('tok123')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchApi('http://api/x')

    const init = fetchMock.mock.calls[0][1]
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer tok123')
  })

  it('não anexa Authorization quando não há token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchApi('http://api/x')

    const init = fetchMock.mock.calls[0][1]
    expect((init.headers as Headers).get('Authorization')).toBeNull()
  })

  it('em 401, faz refresh e reenvia com o novo token', async () => {
    setAuthToken('velho')
    setRefreshTokenFn(vi.fn().mockResolvedValue('novo'))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchApi('http://api/x')

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondInit = fetchMock.mock.calls[1][1]
    expect((secondInit.headers as Headers).get('Authorization')).toBe('Bearer novo')
  })
})

// Um JWT só precisa ser decodificável: quem valida assinatura é o backend.
const jwtExpiringAt = (epochSeconds: number, marker: string) => {
  const payload = btoa(JSON.stringify({ exp: epochSeconds, marker }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `header.${payload}.sig`
}

describe('fetchApi — renovação proativa (bug da primeira requisição)', () => {
  beforeEach(() => {
    setAuthToken(null)
    setRefreshTokenFn(null)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renova ANTES de enviar quando o token restaurado já expirou', async () => {
    const expirado = jwtExpiringAt(Math.floor(Date.now() / 1000) - 60, 'velho')
    const novo = jwtExpiringAt(Math.floor(Date.now() / 1000) + 300, 'novo')

    setAuthToken(expirado)
    setRefreshTokenFn(
      vi.fn().mockImplementation(async () => {
        setAuthToken(novo)
        return novo
      }),
    )

    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchApi('http://api/x')

    // Uma única ida ao servidor, já com o token novo — sem o 401 + retry.
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0][1]
    expect((init.headers as Headers).get('Authorization')).toBe(`Bearer ${novo}`)
  })

  it('não renova quando o token ainda é válido', async () => {
    const valido = jwtExpiringAt(Math.floor(Date.now() / 1000) + 300, 'ok')
    const refresh = vi.fn().mockResolvedValue('nunca')

    setAuthToken(valido)
    setRefreshTokenFn(refresh)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    )

    await fetchApi('http://api/x')

    expect(refresh).not.toHaveBeenCalled()
  })

  it('compartilha uma única renovação entre requisições concorrentes', async () => {
    const expirado = jwtExpiringAt(Math.floor(Date.now() / 1000) - 60, 'velho')
    const novo = jwtExpiringAt(Math.floor(Date.now() / 1000) + 300, 'novo')

    setAuthToken(expirado)
    const refresh = vi.fn().mockImplementation(async () => {
      setAuthToken(novo)
      return novo
    })
    setRefreshTokenFn(refresh)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    )

    // É exatamente o cenário do load da página: várias telas disparando juntas.
    await Promise.all([
      fetchApi('http://api/display-points'),
      fetchApi('http://api/campaign'),
      fetchApi('http://api/sequence'),
    ])

    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
