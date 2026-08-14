import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts';
import { TrendingUp, Wallet, Award, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';

// --- Skeleton Loader ---
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* KPI skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-panel p-6 rounded-2xl min-h-[140px] flex flex-col gap-4">
            <div className="skeleton w-10 h-10 rounded-xl" />
            <div className="skeleton w-24 h-3 rounded-full mt-auto" />
            <div className="skeleton w-32 h-6 rounded-lg" />
          </div>
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="glass-panel p-6 rounded-2xl">
            <div className="skeleton w-48 h-4 rounded-full mb-6" />
            <div className="skeleton w-full rounded-2xl" style={{ height: 380 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Custom Tooltip ---
function CustomTooltip({ active, payload, label, isCurrency = true }) {
  if (!active || !payload || !payload.length) return null;
  const val = payload[0].value;
  return (
    <div style={{
      background: 'rgba(10,10,22,0.96)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 14,
      padding: '10px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(12px)'
    }}>
      {label && <p style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</p>}
      <p style={{ color: '#fff', fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {payload[0].name && <span style={{ color: '#818cf8', marginRight: 6 }}>{payload[0].name}</span>}
        {isCurrency ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : val}
      </p>
    </div>
  );
}

// --- KPI Card ---
function KpiCard({ icon, label, value, accent, delay = 0, children }) {
  return (
    <div
      className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:border-white/15 transition-all duration-300 animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* ambient glow */}
      <div className={`absolute -top-4 -right-4 w-28 h-28 rounded-full blur-3xl opacity-60 ${accent}`} />
      <div className={`p-2.5 rounded-xl w-fit text-sm ${accent.replace('bg-', 'bg-').replace('/5', '/15')} transition-transform group-hover:scale-110 duration-300`}>
        {icon}
      </div>
      {children || (
        <div className="mt-auto">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">{label}</p>
          <h3 className="text-2xl font-black text-white tabular-nums animate-count-up leading-none">{value}</h3>
        </div>
      )}
    </div>
  );
}

export default function DashboardView({ fetchWithAuth, setToast, onSwitchTab }) {
  const [holdings, setHoldings] = useState([]);
  const [inconsistencies, setInconsistencies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryColors, setCategoryColors] = useState({});

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [holdingsRes, incRes, settingsRes] = await Promise.all([
        fetchWithAuth('/api/holdings'),
        fetchWithAuth('/api/check-inconsistencies'),
        fetchWithAuth('/api/settings'),
      ]);
      setHoldings(await holdingsRes.json());
      setInconsistencies(await incRes.json());
      const settings = await settingsRes.json();
      setCategoryColors(settings.category_colors || {});
    } catch (err) {
      setToast({ message: 'Falha ao sincronizar dados do dashboard.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const handleRefresh = () => loadData();
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  const DEFAULT_COLORS = ['#6366f1', '#10b981', '#fbbf24', '#ec4899', '#8b5cf6', '#64748b', '#06b6d4', '#f97316'];

  const totalInvested = holdings.reduce((acc, h) => acc + h.total_invested, 0);
  const totalAssetsCount = holdings.filter(h => h.quantity > 0).length;

  const categoryTotals = holdings.reduce((acc, h) => {
    if (h.quantity > 0) acc[h.category] = (acc[h.category] || 0) + h.total_invested;
    return acc;
  }, {});

  const pieData = Object.keys(categoryTotals).map((category, i) => ({
    name: category,
    value: parseFloat(categoryTotals[category].toFixed(2)),
    color: categoryColors[category] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
  }));

  const barData = holdings
    .filter(h => h.quantity > 0)
    .sort((a, b) => b.total_invested - a.total_invested)
    .slice(0, 10)
    .map((h, i) => ({
      name: h.ticker,
      Valor: parseFloat(h.total_invested.toFixed(2)),
      color: categoryColors[h.category] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
    }));

  // Format Y axis ticks
  const formatYAxis = (v) => {
    if (v >= 1000000) return `R$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
    return `R$${v}`;
  };

  // Center label of donut
  const DonutCenterLabel = ({ viewBox }) => {
    const { cx, cy } = viewBox;
    return (
      <g>
        <text x={cx} y={cy - 10} textAnchor="middle" fill="#e2e8f0" fontSize={12} fontWeight="700" opacity={0.6}>
          Total
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#ffffff" fontSize={13} fontWeight="900">
          {totalInvested >= 1000
            ? `R$${(totalInvested / 1000).toFixed(1)}k`
            : totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </text>
      </g>
    );
  };

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Resumo Geral</h2>
          <p className="text-zinc-400 text-sm mt-1">Visão consolidada da sua alocação de ativos</p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-zinc-400 hover:text-white hover:rotate-180 duration-500"
          style={{ transition: 'all 0.3s ease' }}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <KpiCard
          delay={0}
          accent="bg-indigo-500/5"
          icon={<Wallet className="w-5 h-5 text-indigo-400" />}
          label="Patrimônio Alocado"
          value={totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        />
        <KpiCard
          delay={60}
          accent="bg-emerald-500/5"
          icon={<Award className="w-5 h-5 text-emerald-400" />}
          label="Ativos em Carteira"
          value={`${totalAssetsCount} ativos`}
        />
        <KpiCard
          delay={120}
          accent="bg-violet-500/5"
          icon={<TrendingUp className="w-5 h-5 text-violet-400" />}
          label="Categorias"
          value={`${pieData.length} classes`}
        />

        {/* Inconsistencies card */}
        <div
          className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:border-white/15 transition-all duration-300 animate-slide-up"
          style={{ animationDelay: '180ms' }}
        >
          <div className={`absolute -top-4 -right-4 w-28 h-28 rounded-full blur-3xl opacity-60 ${inconsistencies.length > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/5'}`} />
          <div className={`p-2.5 rounded-xl w-fit transition-transform group-hover:scale-110 duration-300 ${inconsistencies.length > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="mt-auto">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Inconsistências</p>
            <h3 className="text-lg font-black text-white leading-tight">
              {inconsistencies.length === 0 ? '🎉 Tudo ok!' : `${inconsistencies.length} pendência${inconsistencies.length > 1 ? 's' : ''}`}
            </h3>
            {inconsistencies.length > 0 && (
              <button
                onClick={() => onSwitchTab('tab-transacoes')}
                className="mt-2 flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
              >
                Revisar <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Pie Chart — wider on large screens */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col xl:col-span-2 animate-slide-up" style={{ animationDelay: '240ms' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white">Alocação por Categoria</h3>
            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded font-bold uppercase tracking-widest">Clique p/ filtrar</span>
          </div>

          {pieData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-sm py-16">
              Nenhum ativo alocado.
            </div>
          ) : (
            <>
              <div style={{ height: 320, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius="52%"
                      outerRadius="78%"
                      paddingAngle={3}
                      dataKey="value"
                      onClick={(data) => {
                        if (data?.name) {
                          localStorage.setItem('transaction-filter', data.name);
                          onSwitchTab('tab-transacoes');
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="rgba(0,0,0,0.3)"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-4">
                {pieData.map((entry, index) => (
                  <button
                    key={entry.name}
                    onClick={() => { localStorage.setItem('transaction-filter', entry.name); onSwitchTab('tab-transacoes'); }}
                    className="flex items-center gap-2 group/leg text-left"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover/leg:scale-125 duration-200"
                      style={{ backgroundColor: entry.color, boxShadow: `0 0 6px ${entry.color}55` }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-300 truncate group-hover/leg:text-white transition-colors">{entry.name}</p>
                      <p className="text-[10px] text-zinc-500 tabular-nums">
                        {((entry.value / totalInvested) * 100).toFixed(1)}% · {entry.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Bar Chart — wider */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col xl:col-span-3 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white">Maiores Posições</h3>
            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded font-bold uppercase tracking-widest">Top 10 · Clique p/ filtrar</span>
          </div>

          {barData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-sm py-16">
              Nenhum ativo alocado.
            </div>
          ) : (
            <div style={{ height: 380, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 28, right: 12, left: 8, bottom: 8 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatYAxis}
                    tick={{ fill: '#475569', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 6 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0];
                      return (
                        <div style={{
                          background: 'rgba(10,10,22,0.96)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 12,
                          padding: '10px 14px',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        }}>
                          <p style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>{d.payload?.name}</p>
                          <p style={{ color: '#fff', fontSize: 13, fontWeight: 900 }}>
                            {d.value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="Valor"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={52}
                    onClick={(data) => {
                      if (data?.name) {
                        localStorage.setItem('transaction-filter', data.name);
                        onSwitchTab('tab-transacoes');
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="Valor"
                      position="top"
                      style={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                      formatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
