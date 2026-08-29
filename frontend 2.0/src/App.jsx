import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Menu, 
  ShieldCheck, 
  AlertTriangle, 
  UserCheck,
  Eye,
  EyeOff,
  Clock
} from 'lucide-react';
import AuthView from './views/AuthView';
import DashboardView from './views/DashboardView';
import RightMenuDrawer from './components/RightMenuDrawer';
import Toast from './components/Toast';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('tab-dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [inconsistencies, setInconsistencies] = useState([]);
  const [isPrivate, setIsPrivate] = useState(() => {
    return localStorage.getItem('declarativo_privacy') === 'true';
  });

  const togglePrivacy = () => {
    setIsPrivate(prev => {
      const next = !prev;
      localStorage.setItem('declarativo_privacy', String(next));
      return next;
    });
  };

  // Authenticated fetch helper
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
    const stored = localStorage.getItem('token') || '';
    setToken(stored);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUserProfile(null);
    setActiveTab('tab-dashboard');
    setIsDrawerOpen(false);
    setToast({ message: 'Sessão encerrada com sucesso.', type: 'info' });
  };

  // Load user profile and inconsistencies
  const loadInitialData = async () => {
    if (!token) return;
    try {
      const [meRes, incRes] = await Promise.all([
        fetchWithAuth('/api/auth/me'),
        fetchWithAuth('/api/check-inconsistencies')
      ]);

      if (meRes.ok) {
        const me = await meRes.json();
        setUserProfile(me);
      }
      if (incRes.ok) {
        const inc = await incRes.json();
        setInconsistencies(inc);
      }
    } catch (err) {
      console.error('Erro ao carregar dados iniciais:', err);
    }
  };

  useEffect(() => {
    if (token) {
      loadInitialData();
    }
  }, [token]);

  // If not authenticated, show the login & register view
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

  return (
    <div className="min-h-screen bg-[#07070d] text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-white">
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-40 glass-panel border-b border-white/5 px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xl">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tight">
                DeclarAtivo
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                2.0
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-medium hidden sm:block">
              Gestão Tributária & Controle de Carteira
            </p>
          </div>
        </div>

        {/* Right: Actions & Menu Trigger Button */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Market / Live Sync Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-zinc-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] text-zinc-300">B3 Sincronizada</span>
          </div>

          {/* Privacy Toggle Button */}
          <button
            onClick={togglePrivacy}
            className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isPrivate 
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 shadow-md shadow-indigo-500/10'
                : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
            title={isPrivate ? "Desativar modo privacidade (mostrar valores)" : "Ativar modo privacidade (ocultar valores)"}
          >
            {isPrivate ? <EyeOff className="w-4 h-4 text-indigo-400" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline text-[11px]">
              {isPrivate ? 'Oculto' : 'Visível'}
            </span>
          </button>

          {/* Consistency indicator pill */}
          <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            inconsistencies.length === 0
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            {inconsistencies.length === 0 ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[11px]">Regular</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-[11px]">{inconsistencies.length} pendência{inconsistencies.length > 1 ? 's' : ''}</span>
              </>
            )}
          </div>

          {/* User info */}
          {userProfile && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-zinc-300">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-bold truncate max-w-[110px] text-[11px]">{userProfile.username}</span>
            </div>
          )}

          {/* Open Menu Drawer Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            title="Abrir Menu de Navegação"
          >
            <Menu className="w-4 h-4" />
            <span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'tab-dashboard' && (
          <DashboardView
            fetchWithAuth={fetchWithAuth}
            setToast={setToast}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            isPrivate={isPrivate}
            togglePrivacy={togglePrivacy}
          />
        )}
      </main>

      {/* Right-Side Slide-out Navigation Drawer */}
      <RightMenuDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tabId) => setActiveTab(tabId)}
        onLogout={handleLogout}
        username={userProfile?.username || 'Investidor'}
      />

      {/* Global Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
