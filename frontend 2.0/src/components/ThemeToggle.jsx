import React from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ theme = 'dark', onToggle, showLabel = true }) {
  const isDark = theme === 'dark';
  const nextLabel = isDark ? 'Tema claro' : 'Tema escuro';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="theme-control flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold cursor-pointer"
      title={`Alternar para ${nextLabel.toLowerCase()}`}
      aria-label={`Alternar para ${nextLabel.toLowerCase()}`}
      aria-pressed={!isDark}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {showLabel && <span className="hidden sm:inline">{nextLabel}</span>}
    </button>
  );
}
