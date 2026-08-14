import React, { useState, useEffect } from 'react';
import { Copy, Check, CheckSquare, Square, RefreshCw, Calendar, Sparkles } from 'lucide-react';

export default function HoldingsView({ fetchWithAuth, setToast }) {
  const [holdings, setHoldings] = useState([]);
  const [yearlyHoldings, setYearlyHoldings] = useState([]);
  const [declaredStatus, setDeclaredStatus] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('current'); // 'current' or 'yearly'
  const [copiedTicker, setCopiedTicker] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const hRes = await fetchWithAuth('/api/holdings');
      const hData = await hRes.json();
      setHoldings(hData);

      const yRes = await fetchWithAuth('/api/yearly-holdings');
      const yData = await yRes.json();
      setYearlyHoldings(yData);

      const dRes = await fetchWithAuth('/api/declared-status');
      const dData = await dRes.json();
      setDeclaredStatus(dData);
    } catch (err) {
      setToast({ message: 'Falha ao carregar Posição de Bens e Direitos.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      loadData();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  const toggleDeclared = async (ticker, year) => {
    try {
      const res = await fetchWithAuth('/api/toggle-declared-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, year })
      });
      const data = await res.json();
      if (res.ok) {
        setDeclaredStatus(prev => {
          const key = `${ticker.toUpperCase()}:${year}`;
          const next = { ...prev };
          if (data.is_declared) {
            next[key] = true;
          } else {
            delete next[key];
          }
          return next;
        });
        setToast({ message: `Status de declarado atualizado para ${ticker}!`, type: 'success' });
      }
    } catch (err) {
      setToast({ message: 'Falha ao atualizar status.', type: 'error' });
    }
  };

  const handleCopyIRDescription = (h) => {
    const desc = `${h.category.toUpperCase()} - ${h.ticker} - QUANTIDADE: ${h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} COTAS/AÇÕES. CUSTO MÉDIO: ${h.average_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. CUSTO TOTAL ACUMULADO DE AQUISIÇÃO: ${h.total_invested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. CADASTRADO NO CNPJ: ${h.cnpj || 'N/A'}`;
    navigator.clipboard.writeText(desc);
    setCopiedTicker(h.ticker);
    setToast({ message: `Declaração de ${h.ticker} copiada para transferência!`, type: 'success' });
    setTimeout(() => setCopiedTicker(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-zinc-400 font-medium">Carregando carteira consolidada...</p>
      </div>
    );
  }

  // Extract years present in yearly holdings
  const years = Array.from(
    new Set(
      yearlyHoldings.flatMap(h => Object.keys(h.years))
    )
  ).sort();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Bens e Direitos (IRPF)</h2>
          <p className="text-zinc-400 text-sm">Organização de ativos para transferência à ficha anual da Receita Federal</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sub-tab selection */}
          <div className="flex p-1 bg-black/20 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveSubTab('current')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'current' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Posição Atual
            </button>
            <button
              onClick={() => setActiveSubTab('yearly')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'yearly' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Tabela Anual (31/12)
            </button>
          </div>
          <button 
            onClick={loadData}
            className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-zinc-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {activeSubTab === 'current' ? (
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[500px]">
          <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
            <h3 className="text-sm font-bold text-white">Posição Consolidada por Ativo</h3>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded font-bold uppercase tracking-wider">
              Preço Médio FIFO
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full h-full">
              <thead>
                <tr className="border-b border-white/5 bg-black/30">
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-left">Ticker</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-left">Categoria</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-right">Quantidade</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-right">Preço Médio</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-right">Custo Total</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-center">Fórmula IRPF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {holdings.filter(h => h.quantity > 0).length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center text-zinc-500 text-sm">
                      Nenhuma posição em aberto encontrada. Registre novas operações na aba Transações!
                    </td>
                  </tr>
                ) : (
                  holdings.filter(h => h.quantity > 0).map(h => (
                    <tr key={h.ticker} className="group hover:bg-indigo-500/[0.06] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                      <td className="px-6 py-4 text-left">
                        <span className="bg-indigo-500/15 group-hover:bg-indigo-500/25 text-indigo-300 font-bold px-2.5 py-1 rounded text-xs transition-colors">
                          {h.ticker}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-left text-zinc-300 text-xs font-medium group-hover:text-white">
                        {h.category}
                      </td>
                      <td className="px-6 py-4 text-right text-white font-semibold text-xs font-mono">
                        {h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-300 text-xs font-mono group-hover:text-white">
                        {h.average_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-400 font-bold text-xs font-mono group-hover:text-emerald-300">
                        {h.total_invested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleCopyIRDescription(h)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                          title="Copiar texto de descrição IRPF"
                        >
                          {copiedTicker === h.ticker ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                          Copiar Texto
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[500px]">
          <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
            <h3 className="text-sm font-bold text-white">Posição Histórica de Fechamento Anual (31/12)</h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded font-bold uppercase tracking-wider">
              Anualizado
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full h-full">
              <thead>
                <tr className="border-b border-white/5 bg-black/30">
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-400 text-left" rowSpan="2">Ativo</th>
                  {years.map(year => (
                    <th key={year} className="px-6 py-2 text-xs font-bold text-zinc-300 text-center border-l border-white/5" colSpan="3">
                      Posição em 31/12/{year}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-white/5 bg-black/20">
                  {years.map(year => (
                    <React.Fragment key={`sub-${year}`}>
                      <th className="px-4 py-2 text-[10px] font-semibold text-zinc-400 text-right border-l border-white/5">Qtd</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-zinc-400 text-right">Valor</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-zinc-400 text-center">Decl.</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {yearlyHoldings.length === 0 ? (
                  <tr>
                    <td colSpan={1 + years.length * 3} className="px-6 py-16 text-center text-zinc-500 text-sm">
                      Nenhum fechamento anual encontrado no histórico.
                    </td>
                  </tr>
                ) : (
                  yearlyHoldings.map(h => (
                    <tr key={h.ticker} className="group hover:bg-indigo-500/[0.06] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                      <td className="px-6 py-4 text-left font-bold text-zinc-200 group-hover:text-white">
                        <span className="bg-indigo-500/15 group-hover:bg-indigo-500/25 text-indigo-300 font-bold px-2 py-0.5 rounded text-xs transition-colors">
                          {h.ticker}
                        </span>
                      </td>
                      {years.map(year => {
                        const yearData = h.years[year] || { quantity: 0, value: 0 };
                        const key = `${h.ticker.toUpperCase()}:${year}`;
                        const isDeclared = !!declaredStatus[key];
                        return (
                          <React.Fragment key={`${h.ticker}-${year}`}>
                            <td className="px-4 py-4 text-right text-zinc-300 text-xs font-mono border-l border-white/5 group-hover:text-white">
                              {yearData.quantity > 0 ? yearData.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 }) : '-'}
                            </td>
                            <td className="px-4 py-4 text-right text-emerald-400 font-bold text-xs font-mono group-hover:text-emerald-300">
                              {yearData.value > 0 ? yearData.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                            </td>
                            <td className="px-4 py-4 text-center">
                              {yearData.quantity > 0 ? (
                                <button
                                  onClick={() => toggleDeclared(h.ticker, year)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isDeclared 
                                      ? 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20' 
                                      : 'text-zinc-500 bg-white/5 hover:bg-white/10'
                                  }`}
                                  title={isDeclared ? 'Marcado como Declarado!' : 'Marcar como Declarado'}
                                >
                                  {isDeclared ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                </button>
                              ) : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
