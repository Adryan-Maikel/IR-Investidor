import React, { useState, useEffect } from 'react';
import { RefreshCw, Calendar, TrendingUp } from 'lucide-react';

export default function IrMensalView({ fetchWithAuth, setToast }) {
  const [irData, setIrData] = useState({});
  const [selectedMonth, setSelectedMonth] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txRes, tkRes] = await Promise.all([
        fetchWithAuth('/api/transactions'),
        fetchWithAuth('/api/tickers')
      ]);
      const allTransactions = await txRes.json();
      const tickersMap = await tkRes.json();

      const sortedTxs = allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
      const holdings = {};
      const sales = [];

      sortedTxs.forEach(t => {
        const ticker = t.ticker.toUpperCase();
        if (!holdings[ticker]) holdings[ticker] = { qty: 0, totalCost: 0 };
        const h = holdings[ticker];
        const action = t.action.toLowerCase();
        
        if (action === 'comprar' || action === 'recompensa') {
          h.qty += t.quantity;
          h.totalCost += (t.quantity * t.price_per_share) + t.taxes;
        } else if (action === 'vender' && h.qty > 0) {
          const avgPrice = h.totalCost / h.qty;
          const effectiveSoldQty = Math.min(t.quantity, h.qty);
          const saleCost = effectiveSoldQty * avgPrice;
          const profit = (t.quantity * t.price_per_share) - saleCost - t.taxes;
          sales.push({ ...t, avgPriceAtSale: avgPrice, profit: profit, category: tickersMap[ticker]?.category || 'Ações' });
          h.qty -= t.quantity;
          h.totalCost -= saleCost;
          if (h.qty <= 0) { h.qty = 0; h.totalCost = 0; }
        } else if (action === 'desdobramento') { 
          h.qty *= t.quantity; 
        } else if (action === 'grupamento' && t.quantity > 0) { 
          h.qty /= t.quantity; 
        } else if (action === 'incorporacao') {
          const tickerDest = (t.ticker_destino || "").toUpperCase().trim();
          const factor = t.fator_conversao || 1.0;
          
          if (tickerDest && h.qty > 0) {
            if (!holdings[tickerDest]) holdings[tickerDest] = { qty: 0, totalCost: 0 };
            const newQtyTotal = h.qty * factor;
            const qtyDestInt = Math.floor(newQtyTotal);
            const fraction = newQtyTotal - qtyDestInt;
            
            holdings[tickerDest].qty += qtyDestInt;
            holdings[tickerDest].totalCost += h.totalCost;
            
            if (fraction > 0) {
              const avgPriceOrig = h.totalCost / h.qty;
              const fractionCost = (fraction / factor) * avgPriceOrig;
              sales.push({
                ...t,
                ticker: t.ticker,
                action: 'Venda de Frações (Inc.)',
                quantity: fraction,
                price_per_share: 0,
                avgPriceAtSale: avgPriceOrig / factor,
                profit: -fractionCost,
                category: tickersMap[ticker]?.category || 'Ações'
              });
            }
            h.qty = 0;
            h.totalCost = 0;
          }
        }
      });

      // Day Trade Detection
      const dayBuys = {};
      sortedTxs.forEach(t => {
        if (t.action === 'Comprar' || t.action === 'Recompensa') {
          const k = `${t.date}|${t.ticker.toUpperCase()}`;
          dayBuys[k] = (dayBuys[k] || 0) + t.quantity;
        }
      });
      sales.forEach(s => {
        const k = `${s.date}|${s.ticker.toUpperCase()}`;
        if (dayBuys[k] && dayBuys[k] > 0) { s.isDayTrade = true; dayBuys[k] -= s.quantity; }
        else { s.isDayTrade = false; }
      });

      const yearTarget = new Date().getFullYear().toString();
      const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

      const summary = {};
      for (let i = 1; i <= 12; i++) {
        const k = `${yearTarget}-${String(i).padStart(2, '0')}`;
        summary[k] = {
          key: k,
          name: monthNames[i - 1],
          comumAcoes: 0, dtAcoes: 0,
          comumFII: 0, dtFII: 0,
          irrfComum: 0, irrfDT: 0,
        };
      }

      sales.forEach(s => {
        const date = s.date.split('-');
        const k = `${date[0]}-${date[1]}`;
        if (!summary[k]) return;
        const m = summary[k];
        const isFII = s.category === 'FIIs';
        const profit = s.profit;

        if (s.isDayTrade) {
          if (isFII) m.dtFII += profit;
          else m.dtAcoes += profit;
          if (profit > 0) m.irrfDT += profit * 0.01;
        } else {
          if (isFII) m.comumFII += profit;
          else m.comumAcoes += profit;
          m.irrfComum += (s.quantity * s.price_per_share) * 0.00005;
        }
      });

      setIrData(summary);
      if (!selectedMonth) {
        setSelectedMonth(`${yearTarget}-01`);
      }
    } catch (err) {
      setToast({ message: 'Erro ao calcular simulador de IR mensal.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-zinc-400 font-medium">Sincronizando dados tributários do simulador...</p>
      </div>
    );
  }

  const currentData = irData[selectedMonth] || {
    name: 'Janeiro',
    comumAcoes: 0, dtAcoes: 0,
    comumFII: 0, dtFII: 0,
    irrfComum: 0, irrfDT: 0
  };

  const fmt = (v) => v === 0 ? "0,00" : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cls = (v) => v < 0 ? 'text-red-400 font-medium' : v > 0 ? 'text-emerald-400 font-medium' : 'text-zinc-400';

  const impostoDevido = (Math.max(0, currentData.comumAcoes) * 0.15) + (Math.max(0, currentData.dtAcoes) * 0.20);
  const irrfTotal = currentData.irrfComum + currentData.irrfDT;
  const impostoPagar = Math.max(0, impostoDevido - irrfTotal);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Simulador IR Mensal</h2>
          <p className="text-zinc-400 text-sm">Visualização de ganhos no layout padrão do programa da Receita Federal</p>
        </div>
        <button 
          onClick={loadData}
          className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-zinc-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Months List */}
        <div className="glass-panel p-4 rounded-2xl h-fit space-y-1.5 bg-black/20">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 mb-2">Selecione o Mês</p>
          {Object.keys(irData).sort().map(k => {
            const m = irData[k];
            return (
              <button
                key={k}
                onClick={() => setSelectedMonth(k)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                  k === selectedMonth 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{m.name}</span>
                <span className="text-[9px] opacity-75 font-mono">{k.split('-')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Main Simulator Card */}
        <div className="lg:col-span-3 glass-panel p-6 rounded-2xl space-y-6">
          <div className="border-b border-white/5 pb-4 flex justify-between items-center bg-white/[0.01] -m-6 px-6 py-4 rounded-t-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Mercado de Renda Variável - {currentData.name} de {selectedMonth.split('-')[0]}
            </h3>
            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-1 rounded tracking-widest uppercase">
              Simulação de Declaração
            </span>
          </div>

          {/* Section: Mercado a Vista */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Mercado à Vista</h4>
            <div className="border border-white/5 rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-3 bg-black/40 py-2.5 px-4 font-bold text-zinc-400 border-b border-white/5 text-[10px] uppercase tracking-wider">
                <div>Ficha / Ativos</div>
                <div className="text-right">Operações Comuns</div>
                <div className="text-right">Day-Trade</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 border-b border-white/5 bg-white/[0.01]">
                <div className="text-zinc-300">Mercado à vista - ações (Bens comuns)</div>
                <div className={`text-right ${cls(currentData.comumAcoes)}`}>{fmt(currentData.comumAcoes)}</div>
                <div className={`text-right ${cls(currentData.dtAcoes)}`}>{fmt(currentData.dtAcoes)}</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 text-zinc-500">
                <div>Mercado à vista - ouro</div>
                <div className="text-right">0,00</div>
                <div className="text-right">0,00</div>
              </div>
            </div>
          </div>

          {/* Section: Resultados */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Resultados Fiscais</h4>
            <div className="border border-white/5 rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-3 bg-black/40 py-2.5 px-4 font-bold text-zinc-400 border-b border-white/5 text-[10px] uppercase tracking-wider">
                <div>Resumos de compensação</div>
                <div className="text-right">Operações Comuns</div>
                <div className="text-right">Day-Trade</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 border-b border-white/5 bg-white/[0.01]">
                <div className="text-zinc-300 font-semibold">Resultado líquido do mês</div>
                <div className={`text-right ${cls(currentData.comumAcoes)}`}>{fmt(currentData.comumAcoes)}</div>
                <div className={`text-right ${cls(currentData.dtAcoes)}`}>{fmt(currentData.dtAcoes)}</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 border-b border-white/5 text-zinc-500">
                <div>Resultado negativo até o mês anterior</div>
                <div className="text-right text-red-500/80">0,00</div>
                <div className="text-right text-red-500/80">0,00</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 border-b border-white/5">
                <div className="text-zinc-300 font-semibold">Base de cálculo do imposto</div>
                <div className="text-right text-white font-mono">{fmt(Math.max(0, currentData.comumAcoes))}</div>
                <div className="text-right text-white font-mono">{fmt(Math.max(0, currentData.dtAcoes))}</div>
              </div>
              <div className="grid grid-cols-3 py-3 px-4 text-zinc-500">
                <div>Prejuízo a compensar</div>
                <div className="text-right">{fmt(Math.min(0, currentData.comumAcoes))}</div>
                <div className="text-right">{fmt(Math.min(0, currentData.dtAcoes))}</div>
              </div>
            </div>
          </div>

          {/* Totais do imposto */}
          <div className="border-t border-white/5 pt-4 space-y-3">
            <div className="flex justify-between items-center text-xs text-zinc-400 py-1">
              <span>Imposto Devido (Comum 15% / Day Trade 20%)</span>
              <span className="font-bold text-white font-mono">R$ {fmt(impostoDevido)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-zinc-400 py-1">
              <span>Imposto Retido na Fonte ("Dedo-duro" no mês)</span>
              <span className="font-bold text-white font-mono">R$ {fmt(irrfTotal)}</span>
            </div>
            <div className="flex justify-between items-center bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 text-sm">
              <span className="font-bold text-indigo-300">Imposto Líquido a Pagar</span>
              <span className="font-black text-indigo-300 font-mono text-base">R$ {fmt(impostoPagar)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
