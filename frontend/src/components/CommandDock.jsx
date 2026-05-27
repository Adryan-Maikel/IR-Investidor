import React, { useState, useRef, useEffect } from 'react';
import { Plus, Shuffle, ArrowRightLeft, Tags, HelpCircle, GripHorizontal, ChevronRight, Sparkles, Terminal } from 'lucide-react';

export default function CommandDock({ onAction, isOpenInitially = false }) {
  const [isMinimized, setIsMinimized] = useState(!isOpenInitially);
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dockRef = useRef(null);

  // Load saved position
  useEffect(() => {
    const saved = localStorage.getItem('command-dock-position');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure within bounds
        const x = Math.max(10, Math.min(parsed.x, window.innerWidth - 300));
        const y = Math.max(10, Math.min(parsed.y, window.innerHeight - 300));
        setPosition({ x, y });
      } catch (e) {}
    }
  }, []);

  const handleMouseDown = (e) => {
    // Only drag from the header handle
    if (e.target.closest('.drag-handle')) {
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const newX = Math.max(10, Math.min(e.clientX - dragStart.current.x, window.innerWidth - 80));
      const newY = Math.max(10, Math.min(e.clientY - dragStart.current.y, window.innerHeight - 80));
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        localStorage.setItem('command-dock-position', JSON.stringify(position));
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

  const actions = [
    { id: 'new-operation', label: 'Nova Operação', desc: 'Comprar, vender ou bônus', icon: <Plus className="w-4 h-4 text-emerald-400" /> },
    { id: 'new-event', label: 'Evento Societário', desc: 'Desdobrar, agrupar ou fusão', icon: <Shuffle className="w-4 h-4 text-amber-400" /> },
    { id: 'new-swap', label: 'Swap Cripto', desc: 'Troca atômica de moedas', icon: <ArrowRightLeft className="w-4 h-4 text-violet-400" /> },
    { id: 'manage-assets', label: 'Gerenciar Ativos', desc: 'Metadados e CNPJs', icon: <Tags className="w-4 h-4 text-indigo-400" /> }
  ];

  if (isMinimized) {
    return (
      <div 
        ref={dockRef}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        className="fixed z-40 drag-handle cursor-grab active:cursor-grabbing group animate-fade-in"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 shadow-2xl flex items-center justify-center border border-white/20 text-white transition-all hover:scale-110 active:scale-95 duration-300 relative group-hover:glow-primary"
        >
          <Terminal className="w-6 h-6 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-500"></span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={dockRef}
      onMouseDown={handleMouseDown}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-40 w-72 glass-modal rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in select-none"
    >
      {/* Header / Grab Bar */}
      <div className="drag-handle px-4 py-3 bg-white/[0.03] border-b border-white/5 flex items-center justify-between cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-zinc-500" />
          <span className="text-[10px] uppercase font-black text-indigo-400 tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Comandos Flutuantes
          </span>
        </div>
        <button 
          onClick={() => setIsMinimized(true)}
          className="p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Dock Content Buttons */}
      <div className="p-3.5 space-y-2">
        <p className="text-[9px] text-zinc-500 px-1 font-semibold uppercase tracking-wider">Ações Rápidas (Global)</p>
        <div className="space-y-1.5">
          {actions.map(action => (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-indigo-600/10 hover:border-indigo-500/20 text-zinc-300 hover:text-white transition-all flex items-center gap-3 group"
            >
              <div className="p-2 bg-white/[0.02] border border-white/5 rounded-lg group-hover:bg-indigo-500/15 group-hover:border-indigo-500/25 transition-all">
                {action.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold">{action.label}</p>
                <p className="text-[9px] text-zinc-500 group-hover:text-zinc-400 truncate">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
