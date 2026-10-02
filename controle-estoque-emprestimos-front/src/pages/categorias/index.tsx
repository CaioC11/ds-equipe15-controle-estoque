import React, { useState, useEffect } from 'react';
import { categoriaService, type Categoria } from '../../services/categoriaService';

export const CategoriasPage: React.FC = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const carregarCategorias = async () => {
    try {
      setLoading(true);
      const dados = await categoriaService.listar();
      setCategorias(dados);
    } catch {
      setErrorMsg('Erro ao carregar lista de categorias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCategorias();
  }, []);

  const handleOpenModal = (cat?: Categoria) => {
    setErrorMsg(null);
    if (cat) {
      setEditingId(cat.id);
      setNome(cat.nome);
      setDescricao(cat.descricao || '');
    } else {
      setEditingId(null);
      setNome('');
      setDescricao('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNome('');
    setDescricao('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      if (editingId) {
        await categoriaService.atualizar(editingId, { nome, descricao });
        setSuccessMsg('Categoria atualizada com sucesso!');
      } else {
        await categoriaService.criar({ nome, descricao });
        setSuccessMsg('Categoria criada com sucesso!');
      }
      handleCloseModal();
      carregarCategorias();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Erro ao salvar categoria.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir esta categoria?')) return;
    setErrorMsg(null);

    try {
      await categoriaService.remover(id);
      setSuccessMsg('Categoria removida!');
      carregarCategorias();
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || 'Erro ao remover categoria.');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Categorias de Produtos</h1>
          <p className="text-gray-500 text-sm">Gerencie as categorias utilizadas no cadastro de itens</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition"
        >
          + Nova Categoria
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg flex justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Carregando categorias...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
              <tr>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categorias.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 px-4 text-center text-gray-500">
                    Nenhuma categoria encontrada.
                  </td>
                </tr>
              ) : (
                categorias.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{cat.nome}</td>
                    <td className="py-3 px-4 text-gray-600">{cat.descricao || '-'}</td>
                    <td className="py-3 px-4 text-right space-x-3">
                      <button
                        onClick={() => handleOpenModal(cat)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Editar Categoria' : 'Nova Categoria'}
            </h2>

            {errorMsg && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 text-sm rounded">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Informática"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Descrição opcional..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};