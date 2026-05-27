import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Info, AlertTriangle } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  const typeConfig = {
    success: {
      bg: 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />
    },
    error: {
      bg: 'bg-red-950/90 border-red-500/30 text-red-300',
      icon: <AlertCircle className="w-5 h-5 text-red-400" />
    },
    warning: {
      bg: 'bg-amber-950/90 border-amber-500/30 text-amber-300',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />
    },
    info: {
      bg: 'bg-indigo-950/90 border-indigo-500/30 text-indigo-300',
      icon: <Info className="w-5 h-5 text-indigo-400" />
    }
  };

  const config = typeConfig[type] || typeConfig.success;

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 animate-fade-in ${config.bg}`}>
      {config.icon}
      <span className="text-sm font-medium">{message}</span>
      <button 
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
