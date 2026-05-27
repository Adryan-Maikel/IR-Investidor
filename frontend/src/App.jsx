import React, { useState, useEffect } from 'react';
import { Sparkles, LayoutDashboard, Wallet, RefreshCw, Layers, Award, FileText, Calendar, LogOut, Bell, Settings } from 'lucide-react';
import AuthView from './views/AuthView';
import DashboardView from './views/DashboardView';
import HoldingsView from './views/HoldingsView';
import TransactionsView from './views/TransactionsView';
import DarfView from './views/DarfView';
import IrMensalView from './views/IrMensalView';
import FiiFiagroView from './views/FiiFiagroView';
import Toast from './components/Toast';
import Modal from './components/Modal';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [activeTab, setActiveTab] = useState('tab-dashboard');
  const [toast, setToast] = useState(null);
  
  // Notification bell & Inconsistencies states
  const [inconsistencies, setInconsistencies] = useState([]);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Category Colors
  const [categoryColors, setCategoryColors] = useState({});

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

  useEffect(() => {
    if (token) {
      loadInconsistencies();
      loadThemeSettings();
      // Periodically check inconsistencies
      const interval = setInterval(loadInconsistencies, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

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
    <div className="min-h-screen bg-[#0b0b14] flex flex-col">
      {/* Top Header navbar */}
      <header className="sticky top-0 z-30 glass-panel border-b border-white/5 py-4 px-6 md:px-8 flex justify-between items-center shadow-lg">
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
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 md:px-8 py-8 flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="glass-panel p-4 rounded-2xl space-y-1.5 sticky top-24 bg-black/25">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-3 mb-2.5">Navegação</p>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md' 
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        {/* View content panel */}
        <main className="flex-1 min-w-0">
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
    </div>
  );
}
