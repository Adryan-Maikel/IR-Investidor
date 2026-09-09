import React, { useEffect } from 'react';
import {
  Award,
  Calendar,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Layers,
  Lock,
  LogOut,
  Settings,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';

export default function RightMenuDrawer({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  onLogout,
  username = 'Investidor',
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const menuItems = [
    {
      id: 'tab-dashboard',
      label: 'Dashboard',
      description: 'Visão geral do patrimônio',
      icon: LayoutDashboard,
      enabled: true,
    },
    {
      id: 'tab-bens',
      label: 'Bens e Direitos',
      description: 'Posição atual e anual 31/12',
      icon: Wallet,
      enabled: false,
    },
    {
      id: 'tab-transacoes',
      label: 'Transações & Extrato',
      description: 'Compras, vendas e eventos',
      icon: Layers,
      enabled: false,
    },
    {
      id: 'tab-operacoes',
      label: 'DARFs & Vendas',
      description: 'Ganhos de capital apurados',
      icon: Award,
      enabled: false,
    },
    {
      id: 'tab-ir-mensal',
      label: 'Simulador IR Mensal',
      description: 'Apuração mensal de imposto',
      icon: FileText,
      enabled: false,
    },
    {
      id: 'tab-fii-fiagro',
      label: 'FIIs & Fiagro',
      description: 'Apuração anual de fundos',
      icon: Calendar,
      enabled: false,
    },
    {
      id: 'tab-settings',
      label: 'Configurações',
      description: 'Categorias e preferências',
      icon: Settings,
      enabled: false,
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={onClose}
        className="theme-overlay fixed inset-0 animate-fade-in cursor-default"
      />

      <aside className="surface-drawer relative z-10 flex h-full w-full max-w-sm flex-col overflow-hidden animate-drawer-in">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-extrabold text-white">Navegação</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">Módulos do DeclarAtivo</p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-800 p-2 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200 cursor-pointer"
            title="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300">
            <UserCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{username}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Sessão ativa
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            Módulos
          </p>

          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              if (item.enabled) {
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      onClose();
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left cursor-pointer ${
                      isActive
                        ? 'border-indigo-500/30 bg-indigo-500/10 text-white'
                        : 'border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold">{item.label}</p>
                        <p className="mt-0.5 truncate text-[10px] text-zinc-600">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  </button>
                );
              }

              return (
                <div
                  key={item.id}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-zinc-600"
                  title="Módulo em desenvolvimento"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-500">{item.label}</p>
                      <p className="mt-0.5 truncate text-[10px] text-zinc-700">{item.description}</p>
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-1 text-[9px] font-semibold text-zinc-600">
                    <Lock className="h-2.5 w-2.5" />
                    Em breve
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs font-bold text-red-400 hover:bg-red-500/10 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Encerrar sessão
          </button>
          <p className="mt-3 text-center text-[10px] text-zinc-700">DeclarAtivo v2.0</p>
        </div>
      </aside>
    </div>
  );
}
