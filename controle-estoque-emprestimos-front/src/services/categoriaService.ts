export interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
}

//Alternar para false quando o backend estiver pronto no Docker
const USE_MOCK = true;

//Dados iniciais de teste
let mockCategorias: Categoria[] = [
  { id: '1', nome: 'Informática', descricao: 'Notebooks, mouses, teclados e periféricos' },
  { id: '2', nome: 'Ferramentas', descricao: 'Kits de chaves, alicates e multímetros' },
  { id: '3', nome: 'Audiovisual', descricao: 'Projetores, câmeras e microfones' },
];

export const categoriaService = {
  //Listar categorias
  async listar(): Promise<Categoria[]> {
    if (USE_MOCK) {
      return new Promise((resolve) => setTimeout(() => resolve([...mockCategorias]), 300));
    }
    //TODO: Subtituir pelo axios quando o backend subir
    //const res = await api.get('/categorias'); return res.data;
    return [];
  },

  //Criar categoria
  async criar(dados: Omit<Categoria, 'id'>): Promise<Categoria> {
    if (USE_MOCK) {
      const nova: Categoria = { id: String(Date.now()), ...dados };
      mockCategorias.push(nova);
      return new Promise((resolve) => setTimeout(() => resolve(nova), 300));
    }
    return {} as Categoria;
  },

  //Atualizar categoria
  async atualizar(id: string, dados: Omit<Categoria, 'id'>): Promise<Categoria> {
    if (USE_MOCK) {
      mockCategorias = mockCategorias.map((c) => (c.id === id ? { ...c, ...dados } : c));
      return new Promise((resolve) => setTimeout(() => resolve({ id, ...dados }), 300));
    }
    return {} as Categoria;
  },

  //Remover categoria
  async remover(id: string): Promise<void> {
    if (USE_MOCK) {
      // Simulação do requisito: Categoria '1' simulando que tem itens vinculados
      if (id === '1') {
        return new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Categoria possui itens vinculados.')), 300)
        );
      }
      mockCategorias = mockCategorias.filter((c) => c.id !== id);
      return new Promise((resolve) => setTimeout(() => resolve(), 300));
    }
  }
};