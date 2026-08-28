import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Edit3, ArrowRightLeft, Shuffle, Tags, RefreshCw } from 'lucide-react';

export default function TransactionsView({ fetchWithAuth, setToast }) {
  const [transactions, setTransactions] = useState([]);
  const [tickersMap, setTickersMap] = useState({});
  const [search, setSearch] = useState(localStorage.getItem('transaction-filter') || '');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const txRes = await fetchWithAuth('/api/transactions');
      const txData = await txRes.json();
      setTransactions(txData);

      const tkRes = await fetchWithAuth('/api/tickers');
      const tkData = await tkRes.json();
      setTickersMap(tkData);
    } catch (err) {
      setToast({ message: 'Erro ao carregar dados.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    localStorage.removeItem('transaction-filter');
  }, []);

  useEffect(() => {
    const handleRefresh = () => loadData();
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  const handleDeleteTransaction = async (id) => {
    if (!confirm('Deseja realmente excluir esta transação?')) return;
    try {
      const res = await fetchWithAuth(`/api/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToast({ message: 'Transação excluída!', type: 'success' });
        loadData();
      }
    } catch (err) {
      setToast({ message: 'Erro ao excluir transação.', type: 'error' });
    }
  };

  const filteredTxs = transactions.filter(t => {
    const term = search.toLowerCase();
    if (!term) return true;
    const matchesSearch = t.ticker.toLowerCase().includes(term) || t.action.toLowerCase().includes(term);
    const category = tickersMap[t.ticker.toUpperCase()]?.category || '';
    return matchesSearch || category.toLowerCase().includes(term);
  });

  const dispatch = (id) => window.dispatchEvent(new CustomEvent('open-global-modal', { detail: id }));

  return (
    <div className="relative space-y-5 animate-fade-in">

      {/* Header — compact with icon-only action buttons */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Transações e Eventos</h2>
          <p className="text-zinc-500 text-xs mt-0.5">Compras, vendas, desdobramentos e swaps</p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-40 pl-8 pr-3 py-2 bg-white/[0.04] border border-white/8 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:bg-white/[0.06] transition-all"
            />
          </div>

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Nova Operação */}
          <button
            onClick={() => dispatch('new-operation')}
            title="Nova Operação (Comprar / Vender)"
            className="p-2 rounded-lg text-indigo-400 hover:bg-white/[0.06] transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Evento Societário */}
          <button
            onClick={() => dispatch('new-event')}
            title="Evento Societário (Desdobramento / Grupamento / Fusão)"
            className="p-2 rounded-lg text-amber-400 hover:bg-white/[0.06] transition-colors"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Swap Cripto */}
          <button
            onClick={() => dispatch('new-swap')}
            title="Swap Cripto (Troca atômica)"
            className="p-2 rounded-lg text-violet-400 hover:bg-white/[0.06] transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>

          {/* Gerenciar Ativos */}
          <button
            onClick={() => dispatch('manage-assets')}
            title="Gerenciar Ativos (Metadados / CNPJs)"
            className="p-2 rounded-lg text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 transition-colors"
          >
            <Tags className="w-4 h-4" />
          </button>

          {/* Refresh */}
          <button
            onClick={loadData}
            title="Atualizar"
            className="p-2 rounded-lg text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-400 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table — no background card, bare rows */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : filteredTxs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
            <Search className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-zinc-500 text-sm font-medium">
            {search ? `Nenhum resultado para "${search}"` : 'Nenhuma transação registrada ainda.'}
          </p>
          {!search && (
            <button
              onClick={() => dispatch('new-operation')}
              className="mt-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all"
            >
              Registrar primeira operação
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-left uppercase tracking-wider">Data</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-left uppercase tracking-wider">Ticker</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-left uppercase tracking-wider">Operação</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-right uppercase tracking-wider">Quantidade</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-right uppercase tracking-wider">Preço Unit.</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-right uppercase tracking-wider">Taxas</th>
                <th className="px-3 py-3 text-[10px] font-semibold text-zinc-600 text-center uppercase tracking-wider w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxs.map((t, i) => {
                const isIncome = ['comprar', 'recompensa'].includes(t.action.toLowerCase());
                const isCorporate = ['desdobramento', 'grupamento', 'incorporacao'].includes(t.action.toLowerCase());
                return (
                  <tr
                    key={t.id}
                    className="group border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors duration-150"
                    style={{ animationDelay: `${i * 12}ms` }}
                  >
                    <td className="px-3 py-3.5 text-left text-zinc-500 text-xs font-mono group-hover:text-zinc-300 transition-colors">
                      {t.date.split('-').reverse().join('/')}
                    </td>
                    <td className="px-3 py-3.5 text-left">
                      <span className="bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded text-xs transition-colors">
                        {t.ticker}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-left">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                        isCorporate
                          ? 'bg-amber-500/10 text-amber-400'
                          : isIncome
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {t.action}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right text-zinc-400 text-xs font-mono group-hover:text-white transition-colors tabular-nums">
                      {t.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                    </td>
                    <td className="px-3 py-3.5 text-right text-zinc-400 text-xs font-mono group-hover:text-zinc-200 transition-colors tabular-nums">
                      {t.price_per_share > 0
                        ? t.price_per_share.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : <span className="text-zinc-700">—</span>
                      }
                    </td>
                    <td className="px-3 py-3.5 text-right text-zinc-600 text-xs font-mono group-hover:text-zinc-400 transition-colors tabular-nums">
                      {t.taxes > 0
                        ? t.taxes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : <span className="text-zinc-800">—</span>
                      }
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {!isCorporate && (
                          <button
                            onClick={() => window.dispatchEvent(new CustomEvent('edit-global-transaction', { detail: t }))}
                            className="p-1.5 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/15 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTransaction(t.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/15 rounded-lg transition-colors cursor-pointer"
                          title="Deletar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer info */}
          <div className="mt-3 flex items-center justify-between px-1">
            <p className="text-[10px] text-zinc-700 tabular-nums">
              {filteredTxs.length} {filteredTxs.length === 1 ? 'transação' : 'transações'}
              {search && ` encontrada${filteredTxs.length !== 1 ? 's' : ''} para "${search}"`}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
                Limpar filtro
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
