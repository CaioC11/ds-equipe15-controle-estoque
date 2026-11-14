// Cópia de getApiErrorMessage (front/src/services/api.ts L135-156)
const getApiErrorMessage = async (response, fallback) => {
  try {
    const data = await response.clone().json();
    const msg = data?.message ?? data?.error;
    if (Array.isArray(msg)) return msg.filter(Boolean).join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;
  } catch {}
  try {
    const text = await response.text();
    if (text && text.trim()) return text;
  } catch {}
  return fallback;
};

// Corpo no formato do filtro do back (http-exception.filter.ts L45-49)
const corpo = {
  type: 'https://controle-estoque-emprestimos.example/problems/conflict',
  title: 'Conflito de dados',
  status: 409,
  detail: 'Já existe um item com este tombamento.',
};

const resposta = new Response(JSON.stringify(corpo), {
  status: 409,
  headers: { 'Content-Type': 'application/problem+json' },
});

const mensagem = await getApiErrorMessage(resposta, 'Erro ao cadastrar item.');
console.log('mensagem exibida ao usuário =>', mensagem);
