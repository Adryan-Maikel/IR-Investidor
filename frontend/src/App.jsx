import React, { useState, useEffect } from 'react';
import { Sparkles, LayoutDashboard, Wallet, RefreshCw, Layers, Award, FileText, Calendar, LogOut, Bell, Settings, Edit3, Terminal } from 'lucide-react';
import AuthView from './views/AuthView';
import DashboardView from './views/DashboardView';
import HoldingsView from './views/HoldingsView';
import TransactionsView from './views/TransactionsView';
import DarfView from './views/DarfView';
import IrMensalView from './views/IrMensalView';
import FiiFiagroView from './views/FiiFiagroView';
import Toast from './components/Toast';
import Modal from './components/Modal';
import CommandDock from './components/CommandDock';
import TickerPicker from './components/TickerPicker';
import CurrencyInput from './components/CurrencyInput';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [activeTab, setActiveTab] = useState('tab-dashboard');
  const [toast, setToast] = useState(null);
  
  // Notification bell & Inconsistencies states
  const [inconsistencies, setInconsistencies] = useState([]);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Floating Modals visibility states
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isTickerListModalOpen, setIsTickerListModalOpen] = useState(false);
  const [isTickerFormModalOpen, setIsTickerFormModalOpen] = useState(false);

  // Floating Form states
  const [opForm, setOpForm] = useState({ id: '', ticker: '', action: 'Comprar', date: '', quantity: '', price: '', taxes: '0' });
  const [eventForm, setEventForm] = useState({ id: '', ticker: '', action: 'Desdobramento', ticker_destino: '', date: '', quantity: '' });
  const [swapForm, setSwapForm] = useState({ ticker_out: '', qty_out: '', ticker_in: '', qty_in: '', date: '', total_brl: '' });
  const [tickerForm, setTickerForm] = useState({ ticker: '', name: '', category: 'Ações', cnpj: '', is_edit: false });

  const handleOpenNewTickerModal = (prefillCode = '') => {
    setTickerForm({
      ticker: typeof prefillCode === 'string' ? prefillCode.toUpperCase().trim() : '',
      name: '',
      category: 'Ações',
      cnpj: '',
      is_edit: false
    });
    setIsTickerFormModalOpen(true);
  };


  // Unified lists of tickers
  const [tickers, setTickers] = useState([]);

  // Category Colors
  const [categoryColors, setCategoryColors] = useState({});

  // Command Dock state
  const [isDockMinimized, setIsDockMinimized] = useState(false);

  // Helper fetch function that automatically injects the token
  const fetchWithAuth = async (url, options = {}) => {
    options.headers = options.headers || {};
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(url, options);
      if (response.status === 401) {
        handleLogout();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      return response;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  };

  const handleLoginSuccess = () => {
    setToken(localStorage.getItem('token') || '');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setActiveTab('tab-dashboard');
  };

  // Sync inconsistencies
  const loadInconsistencies = async () => {
    if (!token) return;
    try {
      const res = await fetchWithAuth('/api/check-inconsistencies');
      const data = await res.json();
      if (res.ok) {
        setInconsistencies(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadThemeSettings = async () => {
    if (!token) return;
    try {
      const res = await fetchWithAuth('/api/settings');
      const data = await res.json();
      if (res.ok) {
        setCategoryColors(data.category_colors || {});
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadTickers = async () => {
    if (!token) return;
    try {
      const res = await fetchWithAuth('/api/tickers');
      const data = await res.json();
      if (res.ok) {
        const tickersList = Object.keys(data).map(code => ({
          code,
          ...data[code]
        }));
        setTickers(tickersList);
      }
    } catch (err) {
      console.error('Error loading tickers:', err);
    }
  };

  useEffect(() => {
    if (token) {
      loadInconsistencies();
      loadThemeSettings();
      loadTickers();
      // Periodically check inconsistencies
      const interval = setInterval(loadInconsistencies, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Form submits and actions
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
        price_per_share: parseFloat(opForm.price.toString().replace(/[^\d.,]/g, '').replace(',', '.')),
        taxes: parseFloat(opForm.taxes.toString().replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
        date: opForm.date
      };

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setToast({ 
          message: isEdit ? 'Operação atualizada com sucesso!' : 'Operação cadastrada! Modal mantido aberto para a próxima.', 
          type: 'success' 
        });
        
        if (isEdit) {
          setIsOpModalOpen(false);
          setOpForm({ id: '', ticker: '', action: 'Comprar', date: '', quantity: '', price: '', taxes: '0' });
        } else {
          // Keep modal open for rapid continuous entry! Preserve date & action.
          setOpForm(prev => ({
            id: '',
            ticker: '',
            action: prev.action || 'Comprar',
            date: prev.date,
            quantity: '',
            price: '',
            taxes: '0'
          }));
        }

        loadTickers();
        loadInconsistencies();
        window.dispatchEvent(new CustomEvent('refresh-data'));
      } else {
        const error = await res.json();
        setToast({ message: error.detail || 'Falha ao salvar operação.', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Erro na requisição.', type: 'error' });
    }
  };

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
        loadTickers();
        loadInconsistencies();
        window.dispatchEvent(new CustomEvent('refresh-data'));
      } else {
        const error = await res.json();
        setToast({ message: error.detail || 'Falha ao salvar evento.', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Erro na requisição.', type: 'error' });
    }
  };

  const handleSwapSubmit = async (e) => {
    e.preventDefault();
    try {
      const totalBrl = parseFloat(swapForm.total_brl.toString().replace(/[^\d.,]/g, '').replace(',', '.'));
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
        loadTickers();
        loadInconsistencies();
        window.dispatchEvent(new CustomEvent('refresh-data'));
      } else {
        const error = await res.json();
        setToast({ message: error.detail || 'Falha ao salvar swap.', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Erro na requisição.', type: 'error' });
    }
  };

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
        loadTickers();
        loadInconsistencies();
        window.dispatchEvent(new CustomEvent('refresh-data'));
      } else {
        const error = await res.json();
        setToast({ message: error.detail || 'Falha ao salvar ativo.', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Erro na requisição.', type: 'error' });
    }
  };

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

  // Listeners for global modal requests
  useEffect(() => {
    const handleGlobalModalOpen = (e) => {
      const modalId = e.detail;
      const today = new Date().toISOString().split('T')[0];
      if (modalId === 'new-operation') {
        setOpForm({ id: '', ticker: '', action: 'Comprar', date: today, quantity: '', price: '', taxes: '0' });
        setIsOpModalOpen(true);
      } else if (modalId === 'new-event') {
        setEventForm({ id: '', ticker: '', action: 'Desdobramento', ticker_destino: '', date: today, quantity: '' });
        setIsEventModalOpen(true);
      } else if (modalId === 'new-swap') {
        setSwapForm({ ticker_out: '', qty_out: '', ticker_in: '', qty_in: '', date: today, total_brl: '' });
        setIsSwapModalOpen(true);
      } else if (modalId === 'manage-assets') {
        setIsTickerListModalOpen(true);
      }
    };

    const handleEditGlobalTransaction = (e) => {
      const tx = e.detail;
      setOpForm({
        id: tx.id,
        ticker: tx.ticker,
        action: tx.action,
        date: tx.date,
        quantity: tx.quantity.toString(),
        price: tx.price_per_share.toString(),
        taxes: tx.taxes.toString()
      });
      setIsOpModalOpen(true);
    };

    window.addEventListener('open-global-modal', handleGlobalModalOpen);
    window.addEventListener('edit-global-transaction', handleEditGlobalTransaction);
    return () => {
      window.removeEventListener('open-global-modal', handleGlobalModalOpen);
      window.removeEventListener('edit-global-transaction', handleEditGlobalTransaction);
    };
  }, []);

  const ignoreInconsistency = async (ticker, ids = []) => {
    if (!confirm('Deseja marcar como correto? Esta inconsistência não será mais exibida.')) return;
    try {
      const r = await fetchWithAuth('/api/whitelist-inconsistency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, ids })
      });
      if (r.ok) {
        setToast({ message: 'Item ignorado com sucesso!', type: 'success' });
        loadInconsistencies();
      }
    } catch (err) {
      setToast({ message: 'Erro ao ignorar item.', type: 'error' });
    }
  };

  const deleteDuplicateTransaction = async (id) => {
    if (!confirm('Deseja realmente deletar esta transação duplicada?')) return;
    try {
      const res = await fetchWithAuth(`/api/transactions/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setToast({ message: 'Duplicata removida!', type: 'success' });
        loadInconsistencies();
      }
    } catch (err) {
      setToast({ message: 'Erro ao remover duplicata.', type: 'error' });
    }
  };

  const handleSaveColors = async (e) => {
    e.preventDefault();
    try {
      const r = await fetchWithAuth('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { category_colors: categoryColors } })
      });
      if (r.ok) {
        setToast({ message: 'Cores de categorias atualizadas!', type: 'success' });
        setIsThemeModalOpen(false);
      }
    } catch (e) {
      setToast({ message: 'Erro ao salvar configurações.', type: 'error' });
    }
  };

  const handleDockAction = (actionId) => {
    window.dispatchEvent(new CustomEvent('open-global-modal', { detail: actionId }));
  };

  if (!token) {
    return (
      <>
        <AuthView onLoginSuccess={handleLoginSuccess} setToast={setToast} />
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </>
    );
  }

  // Define tab configuration
  const tabs = [
    { id: 'tab-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'tab-bens', label: 'Bens e Direitos', icon: <Wallet className="w-4 h-4" /> },
    { id: 'tab-transacoes', label: 'Transações', icon: <Layers className="w-4 h-4" /> },
    { id: 'tab-operacoes', label: 'DARF/Vendas', icon: <Award className="w-4 h-4" /> },
    { id: 'tab-ir-mensal', label: 'IR Mensal', icon: <FileText className="w-4 h-4" /> },
    { id: 'tab-fii-fiagro', label: 'FIIs/Fiagro', icon: <Calendar className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen bg-[#0b0b14] flex flex-col overflow-x-hidden">
      {/* Top Header navbar */}
      <header className="sticky top-0 z-30 glass-panel border-b border-white/5 py-3.5 px-6 md:px-10 flex justify-between items-center shadow-xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-md">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <h1 className="text-xl font-extrabold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            DeclarAtivo
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications bell */}
          <button 
            onClick={() => setIsNotifModalOpen(true)}
            className={`p-2.5 rounded-xl border transition-all relative ${
              inconsistencies.length > 0 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 animate-bounce' 
                : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]'
            }`}
            title="Inconsistências de dados"
          >
            <Bell className="w-4.5 h-4.5" />
            {inconsistencies.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-black text-[9px] font-black flex items-center justify-center border border-[#0b0b14]">
                {inconsistencies.length}
              </span>
            )}
          </button>

          {/* Theme / Category colors setting */}
          <button 
            onClick={() => setIsThemeModalOpen(true)}
            className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-zinc-400 hover:text-white"
            title="Cores de categorias"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>

          {/* Logout button */}
          <button 
            onClick={handleLogout}
            className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-red-500/10 hover:border-red-500/20 transition-all text-zinc-400 hover:text-red-400"
            title="Sair do sistema"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Main content body with Side menu navigation */}
      <div className="flex-1 w-full px-5 md:px-8 lg:px-10 py-7 flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-52 flex-shrink-0">
          <div className="glass-panel p-3 rounded-2xl space-y-1 sticky top-20 bg-black/30">
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider px-3 mb-2">Navegação</p>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all duration-200 ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-900/40 scale-[1.01]' 
                    : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white hover:translate-x-0.5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}

            {/* Premium Dock integration toggle */}
            <div className="pt-3.5 border-t border-white/5 mt-3">
              <button
                onClick={() => setIsDockMinimized(!isDockMinimized)}
                className={`w-full px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all duration-300 ${
                  !isDockMinimized 
                    ? 'bg-indigo-600/10 border border-indigo-500/10 text-indigo-400' 
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 border border-white/10 text-white shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer'
                }`}
                title={!isDockMinimized ? "Minimizar/Recolher comandos flutuantes" : "Expandir/Flutuar comandos flutuantes"}
              >
                <div className="flex items-center gap-3">
                  <Terminal className="w-4 h-4" />
                  <span>Comandos Rápidos</span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                  !isDockMinimized ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/20 text-white animate-pulse'
                }`}>
                  {!isDockMinimized ? 'Ativo' : 'Flutuar'}
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* View content panel */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          {activeTab === 'tab-dashboard' && (
            <DashboardView 
              fetchWithAuth={fetchWithAuth} 
              setToast={setToast} 
              onSwitchTab={setActiveTab} 
            />
          )}
          {activeTab === 'tab-bens' && (
            <HoldingsView 
              fetchWithAuth={fetchWithAuth} 
              setToast={setToast} 
            />
          )}
          {activeTab === 'tab-transacoes' && (
            <TransactionsView 
              fetchWithAuth={fetchWithAuth} 
              setToast={setToast} 
            />
          )}
          {activeTab === 'tab-operacoes' && (
            <DarfView 
              fetchWithAuth={fetchWithAuth} 
              setToast={setToast} 
            />
          )}
          {activeTab === 'tab-ir-mensal' && (
            <IrMensalView 
              fetchWithAuth={fetchWithAuth} 
              setToast={setToast} 
            />
          )}
          {activeTab === 'tab-fii-fiagro' && (
            <FiiFiagroView 
              fetchWithAuth={fetchWithAuth} 
              setToast={setToast} 
            />
          )}
        </main>
      </div>

      {/* Global Floating Command Dock Hub */}
      <CommandDock 
        onAction={handleDockAction} 
        isMinimized={isDockMinimized} 
        setIsMinimized={setIsDockMinimized} 
      />

      {/* Global Toast component */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Global Inconsistencies notification modal */}
      <Modal 
        isOpen={isNotifModalOpen} 
        onClose={() => setIsNotifModalOpen(false)} 
        title="🔔 Inconsistências de Dados"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-zinc-400">Verifique e solucione divergências societárias encontradas na carteira:</p>
          <div className="divide-y divide-white/5 max-h-[50vh] overflow-y-auto pr-1">
            {inconsistencies.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs font-semibold">
                🎉 Nenhuma inconsistência ou erro de saldo detectado!
              </div>
            ) : (
              inconsistencies.map((item, idx) => (
                <div key={idx} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest ${
                      item.type === 'SALDO_INSUFICIENTE' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {item.type}
                    </span>
                    <h4 className="text-xs font-bold text-white mt-1.5">
                      {item.ticker} {item.date && `• ${item.date.split('-').reverse().join('/')}`}
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{item.message}</p>
                  </div>

                  <div className="flex flex-col gap-1.5 justify-center sm:w-32 flex-shrink-0">
                    <button
                      onClick={() => {
                        setActiveTab('tab-transacoes');
                        setIsNotifModalOpen(false);
                      }}
                      className="w-full py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-zinc-300 transition-all text-center"
                    >
                      Ir para Histórico
                    </button>
                    <button
                      onClick={() => ignoreInconsistency(item.ticker, item.ids)}
                      className="w-full py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-[10px] font-bold transition-all text-center"
                    >
                      Está Correto
                    </button>
                    {item.type === 'DUPLICADO' && (
                      <button
                        onClick={() => deleteDuplicateTransaction(item.ids[0])}
                        className="w-full py-1.5 bg-red-600/15 hover:bg-red-600/25 text-red-400 rounded-lg text-[10px] font-bold transition-all text-center"
                      >
                        Deletar Cópia
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <button 
            onClick={loadInconsistencies}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all mt-4 flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-processar Carteira
          </button>
        </div>
      </Modal>

      {/* Global Theme Settings colors modal */}
      <Modal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} title="🎨 Configurações do Design System">
        <form onSubmit={handleSaveColors} className="space-y-4">
          <p className="text-xs text-zinc-400">Defina cores personalizadas para identificar suas categorias de investimentos:</p>
          
          <div className="space-y-3 bg-black/25 p-4 rounded-xl border border-white/5 max-h-56 overflow-y-auto">
            {['Ações', 'FIIs', 'Cripto', 'BDRs', 'Outros'].map(cat => (
              <div key={cat} className="flex items-center justify-between">
                <label className="text-xs text-zinc-300 font-medium capitalize">{cat}</label>
                <input 
                  type="color"
                  value={categoryColors[cat] || '#6366f1'}
                  onChange={(e) => setCategoryColors({ ...categoryColors, [cat]: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-white/10"
                />
              </div>
            ))}
          </div>

          <button 
            type="submit" 
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all mt-4"
          >
            Salvar Preferências
          </button>
        </form>
      </Modal>

      {/* 1. Modal: Nova Operação */}
      <Modal isOpen={isOpModalOpen} onClose={() => setIsOpModalOpen(false)} title={opForm.id ? "📝 Editar Operação" : "💸 Nova Operação de Compra/Venda"}>
        <form onSubmit={handleOpSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ativo</label>
              <TickerPicker
                value={opForm.ticker}
                onChange={(val) => setOpForm({ ...opForm, ticker: val })}
                tickers={tickers}
                onAddNewTicker={handleOpenNewTickerModal}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ordem</label>
              <select 
                value={opForm.action} 
                onChange={(e) => setOpForm({...opForm, action: e.target.value})} 
                className="w-full py-2.5 px-3 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
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
              <CurrencyInput
                value={opForm.price}
                onChange={(val) => setOpForm({ ...opForm, price: val })}
                placeholder="26,66"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Taxas (B3)</label>
              <CurrencyInput
                value={opForm.taxes}
                onChange={(val) => setOpForm({ ...opForm, taxes: val })}
                placeholder="0,02"
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
              <TickerPicker
                value={eventForm.ticker}
                onChange={(val) => setEventForm({ ...eventForm, ticker: val })}
                tickers={tickers}
                onAddNewTicker={handleOpenNewTickerModal}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Tipo Evento</label>
              <select 
                value={eventForm.action} 
                onChange={(e) => setEventForm({...eventForm, action: e.target.value})} 
                className="w-full py-2.5 px-3 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
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
              <TickerPicker
                value={eventForm.ticker_destino}
                onChange={(val) => setEventForm({ ...eventForm, ticker_destino: val })}
                tickers={tickers}
                onAddNewTicker={handleOpenNewTickerModal}
                required
              />
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
              <TickerPicker
                value={swapForm.ticker_out}
                onChange={(val) => setSwapForm({ ...swapForm, ticker_out: val })}
                tickers={tickers.filter(t => (t.category || '').toLowerCase() === 'cripto')}
                onAddNewTicker={handleOpenNewTickerModal}
                placeholder="Selecione a Cripto de saída..."
                required
              />
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
              <TickerPicker
                value={swapForm.ticker_in}
                onChange={(val) => setSwapForm({ ...swapForm, ticker_in: val })}
                tickers={tickers.filter(t => (t.category || '').toLowerCase() === 'cripto')}
                onAddNewTicker={handleOpenNewTickerModal}
                placeholder="Selecione a Cripto de entrada..."
                required
              />
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
              <CurrencyInput
                value={swapForm.total_brl}
                onChange={(val) => setSwapForm({ ...swapForm, total_brl: val })}
                placeholder="0,00"
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
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-md cursor-pointer"
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
                  className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-white/5 rounded transition-colors cursor-pointer"
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
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center justify-center cursor-pointer font-bold"
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
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all mt-4 cursor-pointer font-bold"
          >
            Salvar Ativo
          </button>
        </form>
      </Modal>
    </div>
  );
}
