import React, { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  const typeConfig = {
    success: {
      classes: 'border-emerald-500/25 text-emerald-300',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    },
    error: {
      classes: 'border-red-500/25 text-red-300',
      icon: <AlertCircle className="h-4 w-4 text-red-400" />,
    },
    warning: {
      classes: 'border-amber-500/25 text-amber-300',
      icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    },
    info: {
      classes: 'border-indigo-500/25 text-indigo-300',
      icon: <Info className="h-4 w-4 text-indigo-400" />,
    },
  };

  const config = typeConfig[type] || typeConfig.success;

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-lg border bg-zinc-900 px-4 py-3 text-sm animate-fade-in ${config.classes}`}>
      {config.icon}
      <span className="font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-1 rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
