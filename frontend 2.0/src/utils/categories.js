// DeclarAtivo color system
// Base palette: #1E401D, #192618, #4D8C30, #F2F2F2, #0D0D0D
// Category colors intentionally stay inside the same forest-green family.

export const CATEGORY_CONFIG = {
  'Ações': {
    color: '#4D8C30',
    bgLight: 'rgba(77, 140, 48, 0.12)',
    border: 'rgba(77, 140, 48, 0.3)',
    label: 'Ações',
    badge: 'Ações'
  },
  'FIIs': {
    color: '#3F7629',
    bgLight: 'rgba(63, 118, 41, 0.12)',
    border: 'rgba(63, 118, 41, 0.3)',
    label: 'FIIs',
    badge: 'FIIs'
  },
  'Fiagro': {
    color: '#315D25',
    bgLight: 'rgba(49, 93, 37, 0.12)',
    border: 'rgba(49, 93, 37, 0.3)',
    label: 'Fiagro',
    badge: 'Fiagro'
  },
  'BDRs': {
    color: '#6AA84F',
    bgLight: 'rgba(106, 168, 79, 0.12)',
    border: 'rgba(106, 168, 79, 0.3)',
    label: 'BDRs',
    badge: 'BDRs'
  },
  'Cripto': {
    color: '#86B86F',
    bgLight: 'rgba(134, 184, 111, 0.12)',
    border: 'rgba(134, 184, 111, 0.3)',
    label: 'Criptoativos',
    badge: 'Cripto'
  },
  'ETFs': {
    color: '#274F21',
    bgLight: 'rgba(39, 79, 33, 0.12)',
    border: 'rgba(39, 79, 33, 0.3)',
    label: 'ETFs',
    badge: 'ETFs'
  },
  'Renda Fixa': {
    color: '#1E401D',
    bgLight: 'rgba(30, 64, 29, 0.12)',
    border: 'rgba(30, 64, 29, 0.3)',
    label: 'Renda Fixa',
    badge: 'RF'
  },
  'Outros': {
    color: '#657061',
    bgLight: 'rgba(101, 112, 97, 0.12)',
    border: 'rgba(101, 112, 97, 0.3)',
    label: 'Outros',
    badge: 'Outros'
  }
};

const FALLBACK_PALETTE = [
  '#4D8C30', '#3F7629', '#315D25', '#6AA84F',
  '#86B86F', '#274F21', '#1E401D', '#657061'
];

/**
 * Returns a category color while respecting custom user colors if available.
 */
export function getCategoryColor(category, userCustomColors = {}, index = 0) {
  if (!category) return '#657061';

  // 1. User custom override
  if (userCustomColors && userCustomColors[category]) {
    return userCustomColors[category];
  }

  // 2. Direct match in preset
  if (CATEGORY_CONFIG[category]) {
    return CATEGORY_CONFIG[category].color;
  }

  // 3. Case-insensitive / partial match
  const lower = category.toLowerCase();
  for (const [key, cfg] of Object.entries(CATEGORY_CONFIG)) {
    if (lower.includes(key.toLowerCase())) {
      return cfg.color;
    }
  }

  // 4. Deterministic fallback from the same green family
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

/**
 * Format currency BRL with full precision or shorthand, respecting privacy mode
 */
export function formatCurrency(value, shorthand = false, isPrivate = false) {
  if (isPrivate) {
    return 'R$ ••••••';
  }
  const num = Number(value) || 0;
  if (shorthand) {
    if (Math.abs(num) >= 1000000) return `R$ ${(num / 1000000).toFixed(1)}M`;
    if (Math.abs(num) >= 1000) return `R$ ${(num / 1000).toFixed(1)}k`;
  }
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Format plain number with privacy masking option
 */
export function formatNumber(value, maxDecimals = 4, isPrivate = false) {
  if (isPrivate) return '••••';
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', { maximumFractionDigits: maxDecimals });
}
