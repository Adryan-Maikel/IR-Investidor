import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Edit3, ArrowRightLeft, Shuffle, Tags, PlusCircle, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';

export default function TransactionsView({ fetchWithAuth, setToast }) {
  const [transactions, setTransactions] = useState([]);
  const [tickersMap, setTickersMap] = useState({});
  const [search, setSearch] = useState(localStorage.getItem('transaction-filter') || '');
  const [isLoading, setIsLoading] = useState(true);

  // Load transactions and tickers mapping
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
    // Clear the click-filter so it doesn't persist across fresh tabs
    localStorage.removeItem('transaction-filter');
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      loadData();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  const handleDeleteTransaction = async (id) => {
    if (!confirm('Deseja realmente excluir esta transação?')) return;
    try {
      const res = await fetchWithAuth(`/api/transactions/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setToast({ message: 'Transação excluída!', type: 'success' });
        loadData();
      }
    } catch (err) {
      setToast({ message: 'Erro ao excluir transação.', type: 'error' });
    }
  };

  // Filter transactions based on search query (by Ticker, Action or Category)
  const filteredTxs = transactions.filter(t => {
    const term = search.toLowerCase();
    if (!term) return true;
    const matchesSearch = t.ticker.toLowerCase().includes(term) || t.action.toLowerCase().includes(term);
    const category = tickersMap[t.ticker.toUpperCase()]?.category || '';
    const matchesCategory = category.toLowerCase().includes(term);
    return matchesSearch || matchesCategory;
  });

  return (
    <div className="relative space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Transações e Eventos</h2>
          <p className="text-zinc-400 text-sm">Registre, altere ou adicione compras, desdobramentos, swaps e ativos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-global-modal', { detail: 'new-operation' }))}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Operação
          </button>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-global-modal', { detail: 'new-event' }))}
            className="px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-zinc-300 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            Desdobrar/Grupamento
          </button>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-global-modal', { detail: 'new-swap' }))}
            className="px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-zinc-300 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Swap Cripto
          </button>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-global-modal', { detail: 'manage-assets' }))}
            className="px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-zinc-300 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Tags className="w-4 h-4" />
            Gerenciar Ativos
          </button>
        </div>
      </div>

      {/* Filter and List Panel */}
      <div className="glass-panel rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[500px]">
        <div className="px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/[0.01]">
          <h3 className="text-sm font-bold text-white">Histórico Geral</h3>
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por Ticker (ex: PETR4)..." 
              className="w-full pl-9 pr-4 py-1.5 bg-black/40 border border-white/5 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full h-full">
              <thead>
                <tr className="border-b border-white/5 bg-black/30">
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-left">Data</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-left">Ticker</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-left">Operação</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-right">Quantidade</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-right">Preço Unitário</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-right">Taxas</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center text-zinc-500 text-sm">
                      Nenhuma transação registrada. Comece a alimentar sua carteira!
                    </td>
                  </tr>
                ) : (
                  filteredTxs.map(t => {
                    const isIncome = ['comprar', 'recompensa'].includes(t.action.toLowerCase());
                    const isCorporate = ['desdobramento', 'grupamento', 'incorporacao'].includes(t.action.toLowerCase());
                    return (
                      <tr key={t.id} className="group hover:bg-indigo-500/[0.06] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                        <td className="px-6 py-4 text-left text-zinc-400 text-xs font-mono group-hover:text-zinc-200">
                          {t.date.split('-').reverse().join('/')}
                        </td>
                        <td className="px-6 py-4 text-left font-bold text-white text-xs">
                          <span className="bg-indigo-500/15 group-hover:bg-indigo-500/25 text-indigo-300 font-bold px-2 py-0.5 rounded text-xs transition-colors">
                            {t.ticker}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-left">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isCorporate 
                              ? 'bg-amber-500/10 text-amber-400' 
                              : isIncome 
                                ? 'bg-emerald-500/10 text-emerald-400' 
                                : 'bg-red-500/10 text-red-400'
                          }`}>
                            {t.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-zinc-300 text-xs font-mono group-hover:text-white">
                          {t.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-6 py-4 text-right text-zinc-300 text-xs font-mono group-hover:text-white">
                          {t.price_per_share > 0 ? t.price_per_share.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right text-zinc-400 text-xs font-mono group-hover:text-zinc-200">
                          {t.taxes > 0 ? t.taxes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-center flex items-center justify-center gap-1.5">
                          {!isCorporate && (
                            <button
                              onClick={() => window.dispatchEvent(new CustomEvent('edit-global-transaction', { detail: t }))}
                              className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                            title="Deletar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
