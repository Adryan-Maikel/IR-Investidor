import React from 'react';

export default function CurrencyInput({
  value = '',
  onChange,
  placeholder = '0,00',
  required = false,
  disabled = false,
  className = '',
  id,
  name
}) {
  // Format any input to BRL currency string (e.g. "2" -> "0,02", "2666" -> "26,66")
  const formatCurrencyString = (val) => {
    if (!val && val !== 0) return '0,00';

    if (typeof val === 'number') {
      return val.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    const digitsOnly = val.toString().replace(/\D/g, '');
    if (!digitsOnly || parseInt(digitsOnly, 10) === 0) {
      return '0,00';
    }

    const num = parseInt(digitsOnly, 10) / 100;
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleChange = (e) => {
    const rawInput = e.target.value;
    const digitsOnly = rawInput.replace(/\D/g, '');

    if (!digitsOnly || parseInt(digitsOnly, 10) === 0) {
      onChange('0,00');
      return;
    }

    const num = parseInt(digitsOnly, 10) / 100;
    const formatted = num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    onChange(formatted);
  };

  const displayValue = formatCurrencyString(value);

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <div className="absolute left-3 flex items-center justify-center pointer-events-none text-indigo-400 font-mono font-bold text-xs select-none">
        R$
      </div>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full py-2 pl-9 pr-3 bg-black/40 border border-white/10 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-zinc-600 disabled:opacity-50"
      />
    </div>
  );
}
