import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Edit3, ArrowRightLeft, Shuffle, Tags, PlusCircle, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';

export default function TransactionsView({ fetchWithAuth, setToast }) {
  const [transactions, setTransactions] = useState([]);
  const [tickers, setTickers] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals visibility states
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isTickerListModalOpen, setIsTickerListModalOpen] = useState(false);
  const [isTickerFormModalOpen, setIsTickerFormModalOpen] = useState(false);

  // Form states
  const [opForm, setOpForm] = useState({ id: '', ticker: '', action: 'Comprar', date: '', quantity: '', price: '', taxes: '0' });
  const [eventForm, setEventForm] = useState({ id: '', ticker: '', action: 'Desdobramento', ticker_destino: '', date: '', quantity: '' });
  const [swapForm, setSwapForm] = useState({ ticker_out: '', qty_out: '', ticker_in: '', qty_in: '', date: '', total_brl: '' });
  const [tickerForm, setTickerForm] = useState({ ticker: '', name: '', category: 'Ações', cnpj: '', is_edit: false });

  // Load transactions and tickers
  const loadData = async () => {
    setIsLoading(true);
    try {
      const txRes = await fetchWithAuth('/api/transactions');
      const txData = await txRes.json();
      setTransactions(txData);

      const tkRes = await fetchWithAuth('/api/tickers');
      const tkData = await tkRes.json();
      // tkData is a Dict[str, TickerMetadata] -> convert to Array of { code, ...metadata }
      const tickersList = Object.keys(tkData).map(code => ({
        code,
        ...tkData[code]
      }));
      setTickers(tickersList);
    } catch (err) {
      setToast({ message: 'Erro ao carregar dados.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleGlobalModalOpen = (e) => {
      const modalId = e.detail;
      if (modalId === 'new-operation') {
        setOpForm({ id: '', ticker: '', action: 'Comprar', date: new Date().toISOString().split('T')[0], quantity: '', price: '', taxes: '0' });
        setIsOpModalOpen(true);
      } else if (modalId === 'new-event') {
        setEventForm({ id: '', ticker: '', action: 'Desdobramento', ticker_destino: '', date: new Date().toISOString().split('T')[0], quantity: '' });
        setIsEventModalOpen(true);
      } else if (modalId === 'new-swap') {
        setSwapForm({ ticker_out: '', qty_out: '', ticker_in: '', qty_in: '', date: new Date().toISOString().split('T')[0], total_brl: '' });
        setIsSwapModalOpen(true);
      } else if (modalId === 'manage-assets') {
        setIsTickerListModalOpen(true);
      }
    };

    window.addEventListener('open-global-modal', handleGlobalModalOpen);
    return () => window.removeEventListener('open-global-modal', handleGlobalModalOpen);
  }, [tickers]);

  // Handle operation submit (Insert / Update)
  const handleOpSubmit = async (e) => {
    e.preventDefault();
    try {
      const isEdit = !!opForm.id;
      const url = isEdit ? `/api/transactions/${opForm.id}` : '/api/transactions';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ticker: opForm.ticker,
        action: opForm.action,
        quantity: parseFloat(opForm.quantity),
        price_per_share: parseFloat(opForm.price.replace(/[^\d.,]/g, '').replace(',', '.')),
        taxes: parseFloat(opForm.taxes.toString().replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
        date: opForm.date
      };

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setToast({ message: isEdit ? 'Operação atualizada com sucesso!' : 'Operação cadastrada!', type: 'success' });
        setIsOpModalOpen(false);
        setOpForm({ id: '', ticker: '', action: 'Comprar', date: '', quantity: '', price: '', taxes: '0' });
        loadData();
      } else {
        const error = await res.json();
        setToast({ message: error.detail || 'Falha ao salvar operação.', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Erro na requisição.', type: 'error' });
    }
  };

  // Handle event submit
  const handleEventSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ticker: eventForm.ticker,
        action: eventForm.action,
        quantity: parseFloat(eventForm.quantity),
        price_per_share: 0,
        taxes: 0,
        date: eventForm.date,
        ticker_destino: eventForm.action === 'Incorporacao' ? eventForm.ticker_destino : null,
        fator_conversao: eventForm.action === 'Incorporacao' ? parseFloat(eventForm.quantity) : null
      };

      const res = await fetchWithAuth('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setToast({ message: 'Evento societário registrado!', type: 'success' });
        setIsEventModalOpen(false);
        setEventForm({ id: '', ticker: '', action: 'Desdobramento', ticker_destino: '', date: '', quantity: '' });
        loadData();
      } else {
        const error = await res.json();
        setToast({ message: error.detail || 'Falha ao salvar evento.', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Erro na requisição.', type: 'error' });
    }
  };

  // Handle atomic swap submit
  const handleSwapSubmit = async (e) => {
    e.preventDefault();
    try {
      const totalBrl = parseFloat(swapForm.total_brl.replace(/[^\d.,]/g, '').replace(',', '.'));
      const payload = [
        {
          ticker: swapForm.ticker_out,
          action: 'Vender',
          quantity: parseFloat(swapForm.qty_out),
          price_per_share: totalBrl / parseFloat(swapForm.qty_out),
          taxes: 0,
          date: swapForm.date
        },
        {
          ticker: swapForm.ticker_in,
          action: 'Comprar',
          quantity: parseFloat(swapForm.qty_in),
          price_per_share: totalBrl / parseFloat(swapForm.qty_in),
          taxes: 0,
          date: swapForm.date
        }
      ];

      const res = await fetchWithAuth('/api/transactions/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setToast({ message: 'Swap atômico realizado com sucesso!', type: 'success' });
        setIsSwapModalOpen(false);
        setSwapForm({ ticker_out: '', qty_out: '', ticker_in: '', qty_in: '', date: '', total_brl: '' });
        loadData();
      } else {
        const error = await res.json();
        setToast({ message: error.detail || 'Falha ao salvar swap.', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Erro na requisição.', type: 'error' });
    }
  };

  // Handle ticker metadata submit
  const handleTickerSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth('/api/tickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: tickerForm.ticker.toUpperCase().trim(),
          name: tickerForm.name,
          cnpj: tickerForm.cnpj,
          category: tickerForm.category
        })
      });

      if (res.ok) {
        setToast({ message: 'Metadados do ativo salvos!', type: 'success' });
        setIsTickerFormModalOpen(false);
        setTickerForm({ ticker: '', name: '', category: 'Ações', cnpj: '', is_edit: false });
        loadData();
      } else {
        const error = await res.json();
        setToast({ message: error.detail || 'Falha ao salvar ativo.', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Erro na requisição.', type: 'error' });
    }
  };

  // Fetch online info via scraper
  const fetchScrapedTickerInfo = async () => {
    const symbol = tickerForm.ticker.toUpperCase().trim();
    if (!symbol) return;
    setToast({ message: 'Buscando informações online...', type: 'info' });
    try {
      const res = await fetchWithAuth(`/api/fetch-ticker-info/${symbol}`);
      const data = await res.json();
      if (res.ok && data.name) {
        setTickerForm(prev => ({
          ...prev,
          name: data.name || prev.name,
          cnpj: data.cnpj || prev.cnpj,
          category: data.category || prev.category
        }));
        setToast({ message: 'Informações carregadas!', type: 'success' });
      } else {
        setToast({ message: 'Nenhuma informação encontrada.', type: 'warning' });
      }
    } catch (err) {
      setToast({ message: 'Erro ao raspar dados.', type: 'error' });
    }
  };

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

  // Filter transactions based on search query
  const filteredTxs = transactions.filter(t => 
    t.ticker.toLowerCase().includes(search.toLowerCase()) || 
    t.action.toLowerCase().includes(search.toLowerCase())
  );

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
            onClick={() => {
              setOpForm({ id: '', ticker: '', action: 'Comprar', date: new Date().toISOString().split('T')[0], quantity: '', price: '', taxes: '0' });
              setIsOpModalOpen(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nova Operação
          </button>
          <button 
            onClick={() => {
              setEventForm({ id: '', ticker: '', action: 'Desdobramento', ticker_destino: '', date: new Date().toISOString().split('T')[0], quantity: '' });
              setIsEventModalOpen(true);
            }}
            className="px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-zinc-300 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Shuffle className="w-4 h-4" />
            Desdobrar/Grupamento
          </button>
          <button 
            onClick={() => {
              setSwapForm({ ticker_out: '', qty_out: '', ticker_in: '', qty_in: '', date: new Date().toISOString().split('T')[0], total_brl: '' });
              setIsSwapModalOpen(true);
            }}
            className="px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-zinc-300 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Swap Cripto
          </button>
          <button 
            onClick={() => setIsTickerListModalOpen(true)}
            className="px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-zinc-300 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Tags className="w-4 h-4" />
            Gerenciar Ativos
          </button>
        </div>
      </div>

      {/* Filter and List Panel */}
      <div className="glass-panel rounded-2xl overflow-hidden">
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

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-black/20">
                  <th className="px-6 py-3.5 text-xs font-semibold text-zinc-400 text-left">Data</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-zinc-400 text-left">Ticker</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-zinc-400 text-left">Operação</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-zinc-400 text-right">Quantidade</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-zinc-400 text-right">Preço Unitário</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-zinc-400 text-right">Taxas</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-zinc-400 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-zinc-500 text-sm">
                      Nenhuma transação registrada. Comece a alimentar sua carteira!
                    </td>
                  </tr>
                ) : (
                  filteredTxs.map(t => {
                    const isIncome = ['comprar', 'recompensa'].includes(t.action.toLowerCase());
                    const isCorporate = ['desdobramento', 'grupamento', 'incorporacao'].includes(t.action.toLowerCase());
                    return (
                      <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-6 py-3.5 text-left text-zinc-400 text-xs font-mono">
                          {t.date.split('-').reverse().join('/')}
                        </td>
                        <td className="px-6 py-3.5 text-left font-bold text-white text-xs">
                          {t.ticker}
                        </td>
                        <td className="px-6 py-3.5 text-left">
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
                        <td className="px-6 py-3.5 text-right text-zinc-300 text-xs font-mono">
                          {t.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-6 py-3.5 text-right text-zinc-300 text-xs font-mono">
                          {t.price_per_share > 0 ? t.price_per_share.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </td>
                        <td className="px-6 py-3.5 text-right text-zinc-500 text-xs font-mono">
                          {t.taxes > 0 ? t.taxes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                        </td>
                        <td className="px-6 py-3.5 text-center flex items-center justify-center gap-1.5">
                          {!isCorporate && (
                            <button
                              onClick={() => {
                                setOpForm({
                                  id: t.id,
                                  ticker: t.ticker,
                                  action: t.action,
                                  date: t.date,
                                  quantity: t.quantity.toString(),
                                  price: t.price_per_share.toString(),
                                  taxes: t.taxes.toString()
                                });
                                setIsOpModalOpen(true);
                              }}
                              className="p-1 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="p-1 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
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

      {/* 1. Modal: Nova Operação */}
      <Modal isOpen={isOpModalOpen} onClose={() => setIsOpModalOpen(false)} title={opForm.id ? "📝 Editar Operação" : "💸 Nova Operação de Compra/Venda"}>
        <form onSubmit={handleOpSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ativo</label>
              <select 
                value={opForm.ticker} 
                onChange={(e) => setOpForm({...opForm, ticker: e.target.value})} 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="">Selecione...</option>
                {tickers.map(tk => (
                  <option key={tk.code} value={tk.code}>{tk.code} - {tk.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ordem</label>
              <select 
                value={opForm.action} 
                onChange={(e) => setOpForm({...opForm, action: e.target.value})} 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="Comprar">Compra</option>
                <option value="Vender">Venda</option>
                <option value="Recompensa">Recompensa</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Data</label>
              <input 
                type="date" 
                value={opForm.date} 
                onChange={(e) => setOpForm({...opForm, date: e.target.value})} 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Quantidade</label>
              <input 
                type="number" 
                step="any" 
                value={opForm.quantity} 
                onChange={(e) => setOpForm({...opForm, quantity: e.target.value})} 
                placeholder="0.00" 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Preço Unitário</label>
              <input 
                type="text" 
                value={opForm.price} 
                onChange={(e) => setOpForm({...opForm, price: e.target.value})} 
                placeholder="R$ 0,00" 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Taxas (B3)</label>
              <input 
                type="text" 
                value={opForm.taxes} 
                onChange={(e) => setOpForm({...opForm, taxes: e.target.value})} 
                placeholder="R$ 0,00" 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all mt-4"
          >
            {opForm.id ? "Salvar Alterações" : "Registrar Operação"}
          </button>
        </form>
      </Modal>

      {/* 2. Modal: Desdobrar / Agrupar */}
      <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title="🔄 Desdobramento / Grupamento / Fusão">
        <form onSubmit={handleEventSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ativo de Origem</label>
              <select 
                value={eventForm.ticker} 
                onChange={(e) => setEventForm({...eventForm, ticker: e.target.value})} 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="">Selecione...</option>
                {tickers.map(tk => (
                  <option key={tk.code} value={tk.code}>{tk.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Tipo Evento</label>
              <select 
                value={eventForm.action} 
                onChange={(e) => setEventForm({...eventForm, action: e.target.value})} 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="Desdobramento">Desdobrar (Split)</option>
                <option value="Grupamento">Agrupar (Inverso)</option>
                <option value="Incorporacao">Incorporação (Fusão)</option>
              </select>
            </div>
          </div>

          {eventForm.action === 'Incorporacao' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ativo de Destino</label>
              <select 
                value={eventForm.ticker_destino} 
                onChange={(e) => setEventForm({...eventForm, ticker_destino: e.target.value})} 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="">Selecione...</option>
                {tickers.map(tk => (
                  <option key={tk.code} value={tk.code}>{tk.code}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Data do Evento</label>
              <input 
                type="date" 
                value={eventForm.date} 
                onChange={(e) => setEventForm({...eventForm, date: e.target.value})} 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                {eventForm.action === 'Incorporacao' ? 'Fator de Conversão' : 'Fator (Ratio)'}
              </label>
              <input 
                type="number" 
                step="any" 
                value={eventForm.quantity} 
                onChange={(e) => setEventForm({...eventForm, quantity: e.target.value})} 
                placeholder="ex: 1.0" 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>
          <p className="text-[10px] text-zinc-500">* Neste evento não há fluxo financeiro direto. No caso de incorporação, o saldo do ativo de origem será zerado proporcionalmente.</p>
          <button 
            type="submit" 
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all mt-4"
          >
            Aplicar Evento Societário
          </button>
        </form>
      </Modal>

      {/* 3. Modal: Swap Cripto */}
      <Modal isOpen={isSwapModalOpen} onClose={() => setIsSwapModalOpen(false)} title="💱 Troca de Cripto (Swap)">
        <form onSubmit={handleSwapSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ativo que Sai (Origem)</label>
              <select 
                value={swapForm.ticker_out} 
                onChange={(e) => setSwapForm({...swapForm, ticker_out: e.target.value})} 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="">Selecione...</option>
                {tickers.filter(t => t.category === 'Cripto').map(tk => (
                  <option key={tk.code} value={tk.code}>{tk.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Qtd de Saída</label>
              <input 
                type="number" 
                step="any" 
                value={swapForm.qty_out} 
                onChange={(e) => setSwapForm({...swapForm, qty_out: e.target.value})} 
                placeholder="0.00" 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ativo que Entra (Destino)</label>
              <select 
                value={swapForm.ticker_in} 
                onChange={(e) => setSwapForm({...swapForm, ticker_in: e.target.value})} 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="">Selecione...</option>
                {tickers.filter(t => t.category === 'Cripto').map(tk => (
                  <option key={tk.code} value={tk.code}>{tk.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Qtd de Entrada</label>
              <input 
                type="number" 
                step="any" 
                value={swapForm.qty_in} 
                onChange={(e) => setSwapForm({...swapForm, qty_in: e.target.value})} 
                placeholder="0.00" 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Data da Troca</label>
              <input 
                type="date" 
                value={swapForm.date} 
                onChange={(e) => setSwapForm({...swapForm, date: e.target.value})} 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Valor Total Equivalente (R$)</label>
              <input 
                type="text" 
                value={swapForm.total_brl} 
                onChange={(e) => setSwapForm({...swapForm, total_brl: e.target.value})} 
                placeholder="R$ 0,00" 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>
          <p className="text-[10px] text-zinc-500">* Registrará uma Venda e uma Compra simultâneas sob o mesmo valor total BRL para fins de Preço Médio e declaração fiscal.</p>
          <button 
            type="submit" 
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all mt-4"
          >
            Confirmar Swap Atômico
          </button>
        </form>
      </Modal>

      {/* 4. Modal: Gerenciar Ativos (List) */}
      <Modal isOpen={isTickerListModalOpen} onClose={() => setIsTickerListModalOpen(false)} title="🏷️ Gerenciar Ativos (Tickers)" maxWidth="max-w-xl">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-zinc-400">Visualize e adicione metadados da empresa/ativo.</p>
            <button 
              onClick={() => {
                setTickerForm({ ticker: '', name: '', category: 'Ações', cnpj: '', is_edit: false });
                setIsTickerFormModalOpen(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-md"
            >
              + Novo Ativo
            </button>
          </div>

          <div className="border border-white/5 rounded-xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-white/5 bg-black/20">
            {tickers.map(tk => (
              <div key={tk.code} className="flex justify-between items-center px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div>
                  <span className="bg-indigo-500/15 text-indigo-300 font-bold px-2 py-0.5 rounded text-[10px]">
                    {tk.code}
                  </span>
                  <span className="text-zinc-400 text-xs font-semibold ml-2">{tk.name || 'Sem nome social'}</span>
                  <div className="text-[10px] text-zinc-500 mt-1">CNPJ: {tk.cnpj || 'N/A'} • Cat: {tk.category}</div>
                </div>
                <button
                  onClick={() => {
                    setTickerForm({ ticker: tk.code, name: tk.name || '', category: tk.category, cnpj: tk.cnpj || '', is_edit: true });
                    setIsTickerFormModalOpen(true);
                  }}
                  className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-white/5 rounded transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* 5. Modal: Cadastrar / Editar Ativo */}
      <Modal isOpen={isTickerFormModalOpen} onClose={() => setIsTickerFormModalOpen(false)} title={tickerForm.is_edit ? "📝 Editar Ativo" : "➕ Cadastrar Novo Ativo"}>
        <form onSubmit={handleTickerSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ticker (Código)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={tickerForm.ticker} 
                onChange={(e) => setTickerForm({...tickerForm, ticker: e.target.value})} 
                placeholder="EX: PETR4" 
                className="flex-1 py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 uppercase"
                required
                disabled={tickerForm.is_edit}
              />
              {!tickerForm.is_edit && (
                <button
                  type="button"
                  onClick={fetchScrapedTickerInfo}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center justify-center"
                  title="Buscar informações automáticas"
                >
                  🔍 Buscar
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Nome / Razão Social</label>
            <input 
              type="text" 
              value={tickerForm.name} 
              onChange={(e) => setTickerForm({...tickerForm, name: e.target.value})} 
              placeholder="PETROLEO BRASILEIRO S.A." 
              className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Categoria</label>
              <select 
                value={tickerForm.category} 
                onChange={(e) => setTickerForm({...tickerForm, category: e.target.value})} 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="Ações">Ações</option>
                <option value="FIIs">FIIs</option>
                <option value="Cripto">Cripto</option>
                <option value="BDRs">BDRs</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">CNPJ</label>
              <input 
                type="text" 
                value={tickerForm.cnpj} 
                onChange={(e) => setTickerForm({...tickerForm, cnpj: e.target.value})} 
                placeholder="00.000.000/0001-00" 
                className="w-full py-2 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all mt-4"
          >
            Salvar Ativo
          </button>
        </form>
      </Modal>
    </div>
  );
}
