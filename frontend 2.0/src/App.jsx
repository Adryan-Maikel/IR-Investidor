import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Calendar,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  Layers,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserCheck,
  Wallet,
} from 'lucide-react';
import AuthView from './views/AuthView';
import DashboardView from './views/DashboardView';
import Toast from './components/Toast';
import ThemeToggle from './components/ThemeToggle';

const WORKSPACE_TABS = [
  {
    id: 'tab-dashboard',
    label: 'Dashboard',
    description: 'Visão geral do patrimônio',
    icon: LayoutDashboard,
  },
  {
    id: 'tab-bens',
    label: 'Bens e Direitos',
    description: 'Posição atual e anual 31/12',
    icon: Wallet,
  },
  {
    id: 'tab-transacoes',
    label: 'Transações',
    description: 'Compras, vendas e eventos',
    icon: Layers,
  },
  {
    id: 'tab-operacoes',
    label: 'DARFs & Vendas',
    description: 'Ganhos de capital apurados',
    icon: Award,
  },
  {
    id: 'tab-ir-mensal',
    label: 'IR Mensal',
    description: 'Apuração mensal de imposto',
    icon: FileText,
  },
  {
    id: 'tab-fii-fiagro',
    label: 'FIIs & Fiagro',
    description: 'Apuração anual de fundos',
    icon: Calendar,
  },
  {
    id: 'tab-settings',
    label: 'Configurações',
    description: 'Categorias e preferências',
    icon: Settings,
  },
];

function ModulePlaceholder({ tab }) {
  const Icon = tab.icon;

  return (
    <section className="surface-panel module-placeholder animate-fade-in">
      <div className="module-placeholder-icon">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--theme-text-subtle)]">
          Módulo
        </p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--theme-text)]">
          {tab.label}
        </h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--theme-text-muted)]">
          {tab.description}. A navegação já está pronta dentro do novo workspace; esta tela pode ser construída aqui sem abrir menus ou trocar de contexto.
        </p>
      </div>
    </section>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('declarativo_theme') === 'light' ? 'light' : 'dark';
  });
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('tab-dashboard');
  const [toast, setToast] = useState(null);
  const [inconsistencies, setInconsistencies] = useState([]);
  const [isHeaderRefreshing, setIsHeaderRefreshing] = useState(false);
  const [isPrivate, setIsPrivate] = useState(() => {
    return localStorage.getItem('declarativo_privacy') === 'true';
  });

  const togglePrivacy = () => {
    setIsPrivate((prev) => {
      const next = !prev;
      localStorage.setItem('declarativo_privacy', String(next));
      return next;
    });
  };

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('declarativo_theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleRefreshState = (event) => {
      if (event.detail?.loading === false) {
        setIsHeaderRefreshing(false);
      }
    };

    window.addEventListener('dashboard-refresh-state', handleRefreshState);
    return () => window.removeEventListener('dashboard-refresh-state', handleRefreshState);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUserProfile(null);
    setActiveTab('tab-dashboard');
    setToast({ message: 'Sessão encerrada com sucesso.', type: 'info' });
  };

  const fetchWithAuth = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await fetch(url, { ...options, headers });
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

  const handleHeaderRefresh = () => {
    if (activeTab !== 'tab-dashboard' || isHeaderRefreshing) return;
    setIsHeaderRefreshing(true);
    window.dispatchEvent(new CustomEvent('refresh-data'));
  };

  useEffect(() => {
    if (!token) return;

    const loadInitialData = async () => {
      try {
        const [meRes, incRes] = await Promise.all([
          fetchWithAuth('/api/auth/me'),
          fetchWithAuth('/api/check-inconsistencies'),
        ]);

        if (meRes.ok) setUserProfile(await meRes.json());
        if (incRes.ok) setInconsistencies(await incRes.json());
      } catch (err) {
        console.error('Erro ao carregar dados iniciais:', err);
      }
    };

    loadInitialData();
  }, [token]);

  if (!token) {
    return (
      <>
        <AuthView
          onLoginSuccess={handleLoginSuccess}
          setToast={setToast}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
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

  const activeTabConfig = WORKSPACE_TABS.find((tab) => tab.id === activeTab) || WORKSPACE_TABS[0];

  return (
    <div className="theme-shell min-h-screen flex flex-col">
      <header className="theme-header sticky top-0 z-40 border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black">
                D
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-extrabold tracking-tight text-[var(--theme-text)] sm:text-base">
                    DeclarAtivo
                  </h1>
                  <span className="version-badge rounded-md px-1.5 py-0.5 text-[9px] font-bold">
                    2.0
                  </span>
                </div>
                <p className="hidden text-[10px] text-[var(--theme-text-muted)] sm:block">
                  Gestão tributária e controle de carteira
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 text-[11px] text-[var(--theme-text-muted)] lg:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-accent)]" />
                B3 sincronizada
              </div>

              <button
                type="button"
                onClick={handleHeaderRefresh}
                disabled={activeTab !== 'tab-dashboard' || isHeaderRefreshing}
                className="theme-icon-button"
                title={activeTab === 'tab-dashboard' ? 'Sincronizar carteira' : 'Sincronização disponível no Dashboard'}
                aria-label="Sincronizar carteira"
              >
                <RefreshCw className={`h-4 w-4 ${isHeaderRefreshing ? 'animate-spin' : ''}`} />
              </button>

              <ThemeToggle theme={theme} onToggle={toggleTheme} />

              <button
                onClick={togglePrivacy}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold cursor-pointer ${
                  isPrivate
                    ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
                title={isPrivate ? 'Mostrar valores' : 'Ocultar valores'}
              >
                {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="hidden sm:inline">{isPrivate ? 'Oculto' : 'Visível'}</span>
              </button>

              <div
                className={`hidden items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold md:flex ${
                  inconsistencies.length === 0
                    ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400'
                    : 'border-amber-500/25 bg-amber-500/5 text-amber-400'
                }`}
              >
                {inconsistencies.length === 0 ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Regular
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {inconsistencies.length} pendência{inconsistencies.length > 1 ? 's' : ''}
                  </>
                )}
              </div>

              {userProfile && (
                <div className="hidden items-center gap-2 border-l border-[var(--theme-border)] pl-3 text-[11px] text-[var(--theme-text-muted)] sm:flex">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span className="max-w-[110px] truncate font-semibold text-[var(--theme-text)]">
                    {userProfile.username}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="theme-icon-button theme-icon-button-danger"
                title="Encerrar sessão"
                aria-label="Encerrar sessão"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="workspace-nav-wrap">
          <nav className="workspace-nav mx-auto w-full max-w-7xl" aria-label="Navegação principal">
            {WORKSPACE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`workspace-tab ${isActive ? 'workspace-tab-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  title={tab.description}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-8 pt-5 sm:px-6 sm:pb-10 lg:px-8">
        <div className="workspace-page">
          {activeTab === 'tab-dashboard' ? (
            <DashboardView
              fetchWithAuth={fetchWithAuth}
              setToast={setToast}
              isPrivate={isPrivate}
            />
          ) : (
            <ModulePlaceholder tab={activeTabConfig} />
          )}
        </div>
      </main>

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
