import React, { useEffect } from 'react';
import { 
  X, 
  LayoutDashboard, 
  Wallet, 
  Layers, 
  Award, 
  FileText, 
  Calendar, 
  Settings, 
  LogOut, 
  Sparkles, 
  ChevronRight, 
  Lock,
  UserCheck
} from 'lucide-react';

export default function RightMenuDrawer({ 
  isOpen, 
  onClose, 
  activeTab, 
  onSelectTab, 
  onLogout,
  username = 'Investidor'
}) {
  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Menu items list
  const menuItems = [
    {
      id: 'tab-dashboard',
      label: 'Dashboard',
      description: 'Visão geral do patrimônio',
      icon: LayoutDashboard,
      color: 'text-indigo-400',
      bgHover: 'hover:bg-indigo-500/10',
      enabled: true
    },
    {
      id: 'tab-bens',
      label: 'Bens e Direitos',
      description: 'Posição atual & Anual 31/12',
      icon: Wallet,
      color: 'text-emerald-400',
      bgHover: 'hover:bg-emerald-500/10',
      enabled: false
    },
    {
      id: 'tab-transacoes',
      label: 'Transações & Extrato',
      description: 'Compras, vendas e eventos',
      icon: Layers,
      color: 'text-cyan-400',
      bgHover: 'hover:bg-cyan-500/10',
      enabled: false
    },
    {
      id: 'tab-operacoes',
      label: 'DARFs & Vendas',
      description: 'Ganhos de capital apurados',
      icon: Award,
      color: 'text-amber-400',
      bgHover: 'hover:bg-amber-500/10',
      enabled: false
    },
    {
      id: 'tab-ir-mensal',
      label: 'Simulador IR Mensal',
      description: 'Layout oficial Receita Federal',
      icon: FileText,
      color: 'text-rose-400',
      bgHover: 'hover:bg-rose-500/10',
      enabled: false
    },
    {
      id: 'tab-fii-fiagro',
      label: 'FIIs & Fiagro',
      description: 'Apuração anual de fundos',
      icon: Calendar,
      color: 'text-violet-400',
      bgHover: 'hover:bg-violet-500/10',
      enabled: false
    },
    {
      id: 'tab-settings',
      label: 'Configurações',
      description: 'Cores de categorias & preferências',
      icon: Settings,
      color: 'text-zinc-400',
      bgHover: 'hover:bg-white/5',
      enabled: false
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
      />

      {/* Drawer Panel */}
      <aside 
        className="relative w-full max-w-sm sm:max-w-md h-full glass-drawer flex flex-col z-10 animate-drawer-in overflow-hidden"
      >
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                Navegação 2.0
              </h2>
              <p className="text-[11px] text-zinc-400 font-medium">Módulos do DeclarAtivo</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-all cursor-pointer"
            title="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User profile card */}
        <div className="px-6 py-4 border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{username}</p>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sessão Ativa
              </span>
            </div>
          </div>
        </div>

        {/* Menu list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 mb-2">
            Módulos do Sistema
          </p>

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
                  className={`w-full text-left p-3.5 rounded-2xl flex items-center justify-between transition-all duration-200 group cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-white shadow-lg shadow-indigo-500/10'
                      : 'border border-transparent hover:bg-white/[0.04] text-zinc-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-xl ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/5 ' + item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{item.label}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all`} />
                </button>
              );
            }

            // Disabled item representation
            return (
              <div
                key={item.id}
                className="w-full p-3.5 rounded-2xl flex items-center justify-between border border-white/[0.03] bg-black/10 opacity-55 cursor-not-allowed select-none"
                title="Módulo sendo preparado para o Frontend 2.0"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] text-zinc-500">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-zinc-400">{item.label}</p>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[9px] font-semibold text-zinc-400">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Em breve</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with Logout button */}
        <div className="p-4 border-t border-white/5 bg-black/30 space-y-3">
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full py-3 px-4 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Encerrar Sessão
          </button>
          <div className="text-center">
            <span className="text-[10px] text-zinc-600 font-medium tracking-wide">
              DeclarAtivo v2.0 · Frontend 2.0
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
