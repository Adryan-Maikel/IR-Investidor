// Category color harmony system for DeclarAtivo 2.0
// Ensures consistent, vibrant, and distinguishable colors for each asset category across all charts & UI

export const CATEGORY_CONFIG = {
  'Ações': {
    color: '#6366F1', // Indigo Vibrant
    bgLight: 'rgba(99, 102, 241, 0.12)',
    border: 'rgba(99, 102, 241, 0.3)',
    label: 'Ações',
    badge: 'Ações'
  },
  'FIIs': {
    color: '#10B981', // Emerald Bright
    bgLight: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    label: 'FIIs',
    badge: 'FIIs'
  },
  'Fiagro': {
    color: '#059669', // Deep Emerald / Teal
    bgLight: 'rgba(5, 150, 105, 0.12)',
    border: 'rgba(5, 150, 105, 0.3)',
    label: 'Fiagro',
    badge: 'Fiagro'
  },
  'BDRs': {
    color: '#06B6D4', // Cyan Electric
    bgLight: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.3)',
    label: 'BDRs',
    badge: 'BDRs'
  },
  'Cripto': {
    color: '#F59E0B', // Amber / Gold Glow
    bgLight: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
    label: 'Criptoativos',
    badge: 'Cripto'
  },
  'ETFs': {
    color: '#EC4899', // Pink / Magenta
    bgLight: 'rgba(236, 72, 153, 0.12)',
    border: 'rgba(236, 72, 153, 0.3)',
    label: 'ETFs',
    badge: 'ETFs'
  },
  'Renda Fixa': {
    color: '#8B5CF6', // Purple Soft
    bgLight: 'rgba(139, 92, 246, 0.12)',
    border: 'rgba(139, 92, 246, 0.3)',
    label: 'Renda Fixa',
    badge: 'RF'
  },
  'Outros': {
    color: '#64748B', // Slate
    bgLight: 'rgba(100, 116, 139, 0.12)',
    border: 'rgba(100, 116, 139, 0.3)',
    label: 'Outros',
    badge: 'Outros'
  }
};

const FALLBACK_PALETTE = [
  '#6366F1', '#10B981', '#F59E0B', '#06B6D4',
  '#EC4899', '#8B5CF6', '#3B82F6', '#14B8A6'
];

/**
 * Returns harmonious color for a given category name, respecting custom user colors if available.
 */
export function getCategoryColor(category, userCustomColors = {}, index = 0) {
  if (!category) return '#64748B';
  
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
  
  // 4. Deterministic fallback from palette
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

/**
 * Format currency BRL with full precision or shorthand
 */
export function formatCurrency(value, shorthand = false) {
  const num = Number(value) || 0;
  if (shorthand) {
    if (Math.abs(num) >= 1000000) return `R$ ${(num / 1000000).toFixed(1)}M`;
    if (Math.abs(num) >= 1000) return `R$ ${(num / 1000).toFixed(1)}k`;
  }
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
