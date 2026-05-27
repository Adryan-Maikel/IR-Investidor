import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Wallet, Award, AlertCircle, RefreshCw } from 'lucide-react';

export default function DashboardView({ fetchWithAuth, setToast, onSwitchTab }) {
  const [holdings, setHoldings] = useState([]);
  const [inconsistencies, setInconsistencies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const holdingsRes = await fetchWithAuth('/api/holdings');
      const holdingsData = await holdingsRes.json();
      setHoldings(holdingsData);

      const incRes = await fetchWithAuth('/api/check-inconsistencies');
      const incData = await incRes.json();
      setInconsistencies(incData);
    } catch (err) {
      setToast({ message: 'Falha ao sincronizar dados do dashboard.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Process data for charts
  const totalInvested = holdings.reduce((acc, h) => acc + h.total_invested, 0);
  const totalAssetsCount = holdings.filter(h => h.quantity > 0).length;

  const categoryTotals = holdings.reduce((acc, h) => {
    if (h.quantity > 0) {
      acc[h.category] = (acc[h.category] || 0) + h.total_invested;
    }
    return acc;
  }, {});

  const pieData = Object.keys(categoryTotals).map(category => ({
    name: category,
    value: parseFloat(categoryTotals[category].toFixed(2))
  }));

  const COLORS = ['#6366f1', '#10b981', '#fbbf24', '#ec4899', '#8b5cf6', '#64748b'];

  const barData = holdings
    .filter(h => h.quantity > 0)
    .sort((a, b) => b.total_invested - a.total_invested)
    .slice(0, 8)
    .map(h => ({
      name: h.ticker,
      Valor: parseFloat(h.total_invested.toFixed(2))
    }));

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-zinc-400 font-medium">Sincronizando estatísticas avançadas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Resumo Geral</h2>
          <p className="text-zinc-400 text-sm">Visão consolidada da sua alocação de ativos</p>
        </div>
        <button 
          onClick={loadData}
          className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-zinc-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Patrimônio Alocado</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ativos em Carteira</p>
              <h3 className="text-2xl font-bold text-white mt-1">{totalAssetsCount} ativos</h3>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden col-span-2">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Inconsistências Pendentes</p>
                <h3 className="text-lg font-bold text-white mt-1">
                  {inconsistencies.length === 0 
                    ? '🎉 Tudo regularizado!' 
                    : `${inconsistencies.length} pendências encontradas`}
                </h3>
              </div>
            </div>
            {inconsistencies.length > 0 && (
              <button 
                onClick={() => onSwitchTab('tab-transacoes')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl transition-all shadow-lg"
              >
                Revisar Transações
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Pie Chart */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col">
          <h3 className="text-sm font-bold text-zinc-300 mb-6">Alocação por Categoria</h3>
          {pieData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-sm">
              Nenhum ativo alocado no momento.
            </div>
          ) : (
            <div className="flex-1 h-[300px] flex items-center">
              <div className="w-2/3 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      contentStyle={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/3 flex flex-col gap-2 justify-center pl-4">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-300 truncate">{entry.name}</p>
                      <p className="text-[10px] text-zinc-500">
                        {((entry.value / totalInvested) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Holdings Bar Chart */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col">
          <h3 className="text-sm font-bold text-zinc-300 mb-6">Maiores Posições em Carteira</h3>
          {barData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-sm">
              Nenhum ativo alocado no momento.
            </div>
          ) : (
            <div className="flex-1 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip 
                    formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    contentStyle={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                  />
                  <Bar dataKey="Valor" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#6366f1" />
                    ))}
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
