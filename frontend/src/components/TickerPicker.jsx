import React, { useState, useEffect, useRef } from 'react';
import { Plus, Check, ChevronDown } from 'lucide-react';

export default function TickerPicker({
  value = '',
  onChange,
  tickers = [],
  onAddNewTicker,
  placeholder = 'Buscar ou selecionar ativo (ex: BBAS3)...',
  required = false,
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categories = ['Todos', 'Ações', 'FIIs', 'Cripto', 'BDRs'];

  // Filter tickers based on search text typed in main input and selected category
  const query = (value || '').trim().toLowerCase();
  const filteredTickers = tickers.filter((t) => {
    const matchesSearch =
      !query ||
      t.code.toLowerCase().includes(query) ||
      (t.name && t.name.toLowerCase().includes(query)) ||
      (t.category && t.category.toLowerCase().includes(query));

    const matchesCategory =
      selectedCategory === 'Todos' ||
      (t.category || 'Ações').toLowerCase() === selectedCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  const handleInputChange = (e) => {
    const val = e.target.value.toUpperCase();
    onChange(val);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = (code) => {
    onChange(code);
    setIsOpen(false);
  };

  const handleCreateNew = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(false);
    if (onAddNewTicker) {
      onAddNewTicker(value);
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {/* Sleek Input Bar */}
      <div className="relative flex items-center w-full">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full py-2 pl-3 pr-16 bg-black/40 border rounded-xl text-xs font-mono font-bold text-white uppercase focus:outline-none transition-all placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-zinc-500 ${
            isOpen
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-black/60'
              : 'border-white/10 hover:border-white/20'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />

        {/* Integrated Clean Action Icons (+ and Arrow) */}
        <div className="absolute right-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCreateNew}
            className="p-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
            title="Criar Novo Ativo (+)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="p-0.5 text-zinc-400 hover:text-white transition-colors"
            tabIndex={-1}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-indigo-400' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Autocomplete Dropdown List */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 glass-panel rounded-xl border border-white/10 shadow-2xl overflow-hidden bg-[#121222]/95 backdrop-blur-xl">
          {/* Category Tabs */}
          <div className="px-2 py-1.5 border-b border-white/5 bg-black/30 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Items List */}
          <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
            {filteredTickers.length === 0 ? (
              <div className="p-3 text-center space-y-1.5">
                <p className="text-xs text-zinc-400">Nenhum ativo encontrado para "{value}"</p>
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="w-full py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Cadastrar "{value.toUpperCase() || 'Novo Ativo'}"
                </button>
              </div>
            ) : (
              filteredTickers.map((t) => {
                const isSelected =
                  (value || '').trim().toUpperCase() === t.code.toUpperCase();
                return (
                  <div
                    key={t.code}
                    onClick={() => handleSelect(t.code)}
                    className={`px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-600/20 text-white border border-indigo-500/30'
                        : 'hover:bg-white/5 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="font-mono font-bold text-xs text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded shrink-0">
                        {t.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-white truncate">
                          {t.name || t.code}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono truncate">
                          {t.cnpj ? `CNPJ: ${t.cnpj}` : t.category || 'Ativo'}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
