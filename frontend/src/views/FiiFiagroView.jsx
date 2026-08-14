import React, { useState, useEffect } from 'react';
import { RefreshCw, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

export default function FiiFiagroView({ fetchWithAuth, setToast }) {
  const [reports, setReports] = useState({});
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txRes, tkRes] = await Promise.all([
        fetchWithAuth('/api/transactions'),
        fetchWithAuth('/api/tickers')
      ]);
      const transactions = await txRes.json();
      const tickersMap = await tkRes.json();

      const sortedTxs = [...transactions].sort((a, b) => {
        const dateDiff = new Date(a.date) - new Date(b.date);
        if (dateDiff !== 0) return dateDiff;
        const priority = { 'Comprar': 1, 'Recompensa': 1, 'Desdobramento': 2, 'Grupamento': 2, 'Incorporacao': 3, 'Vender': 4 };
        return (priority[a.action] || 5) - (priority[b.action] || 5);
      });

      const holdings = {};
      const monthlyResults = {};
      const monthlyDetails = {};
      const yearSet = new Set();

      sortedTxs.forEach(tx => {
        const ticker = tx.ticker.toUpperCase();
        if (!ticker || !tx.date) return;

        const action = tx.action.toLowerCase();
        const qty = tx.quantity || 0;
        const price = tx.price_per_share || 0;
        const taxes = tx.taxes || 0;
        const meta = tickersMap[ticker] || {};
        const category = meta.category || 'Ações';
        const isFiiFiagro = category === 'FIIs';

        yearSet.add(tx.date.slice(0, 4));

        if (!holdings[ticker]) holdings[ticker] = { qty: 0, totalCost: 0 };
        const h = holdings[ticker];

        if (action === 'comprar' || action === 'recompensa') {
          h.qty += qty;
          h.totalCost += (qty * price) + taxes;
          return;
        }

        if (action === 'vender') {
          const avgPrice = h.qty > 0 ? h.totalCost / h.qty : price;
          const effectiveSoldQty = h.qty > 0 ? Math.min(qty, h.qty) : qty;
          const saleCost = effectiveSoldQty * avgPrice;
          const saleRevenue = qty * price;
          const result = saleRevenue - saleCost - taxes;

          if (isFiiFiagro) {
            const monthKey = tx.date.slice(0, 7);
            monthlyResults[monthKey] = (monthlyResults[monthKey] || 0) + result;

            if (!monthlyDetails[monthKey]) monthlyDetails[monthKey] = [];
            monthlyDetails[monthKey].push({
              date: tx.date,
              ticker,
              quantity: qty,
              saleRevenue,
              avgPrice,
              saleCost,
              taxes,
              result
            });
          }

          h.qty -= qty;
          h.totalCost -= saleCost;

          if (h.qty <= 1e-10) {
            h.qty = 0;
            h.totalCost = 0;
          }
          return;
        }

        if (action === 'desdobramento') {
          h.qty *= qty;
          return;
        }

        if (action === 'grupamento') {
          if (qty > 0) h.qty /= qty;
          return;
        }

        if (action === 'incorporacao') {
          const tickerDest = (tx.ticker_destino || "").toUpperCase().trim();
          const factor = tx.fator_conversao || tx.quantity || 1.0;

          if (!tickerDest) return;

          if (!holdings[tickerDest]) holdings[tickerDest] = { qty: 0, totalCost: 0 };
          holdings[tickerDest].qty += h.qty * factor;
          holdings[tickerDest].totalCost += h.totalCost;

          h.qty = 0;
          h.totalCost = 0;
        }
      });

      Object.keys(monthlyResults).forEach(k => yearSet.add(k.slice(0, 4)));
      const yearsList = Array.from(yearSet).filter(Boolean).sort();
      const compiledReports = {};

      let accumulatedLoss = 0;
      const FII_MONTHS = [
        { key: '01', label: 'Janeiro' }, { key: '02', label: 'Fevereiro' }, { key: '03', label: 'Março' },
        { key: '04', label: 'Abril' }, { key: '05', label: 'Maio' }, { key: '06', label: 'Junho' },
        { key: '07', label: 'Julho' }, { key: '08', label: 'Agosto' }, { key: '09', label: 'Setembro' },
        { key: '10', label: 'Outubro' }, { key: '11', label: 'Novembro' }, { key: '12', label: 'Dezembro' }
      ];

      yearsList.forEach(year => {
        const rows = [];
        FII_MONTHS.forEach(month => {
          const monthKey = `${year}-${month.key}`;
          const result = monthlyResults[monthKey] || 0;
          const previousLoss = accumulatedLoss;
          const taxableBase = result > 0 ? Math.max(result - previousLoss, 0) : 0;

          if (result < 0) {
            accumulatedLoss = previousLoss + Math.abs(result);
          } else if (result > 0) {
            accumulatedLoss = Math.max(previousLoss - result, 0);
          }

          const taxDue = taxableBase * 0.20;

          rows.push({
            month: month.label,
            monthKey,
            result,
            previousLoss,
            taxableBase,
            lossToCarry: accumulatedLoss,
            taxRate: 20,
            taxDue,
            taxToPay: taxDue,
            details: monthlyDetails[monthKey] || []
          });
        });
        compiledReports[year] = rows;
      });

      setReports(compiledReports);
      setYears(yearsList);

      const currentYear = new Date().getFullYear().toString();
      if (!selectedYear) {
        setSelectedYear(yearsList.includes(currentYear) ? currentYear : (yearsList[yearsList.length - 1] || currentYear));
      }
    } catch (err) {
      setToast({ message: 'Erro ao processar apuração anual de FIIs.', type: 'error' });
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

  const handleCopyTable = () => {
    const rows = reports[selectedYear] || [];
    if (rows.length === 0) return;

    const headers = [
      'Mês',
      'Resultado líquido do mês',
      'Resultado negativo até mês anterior',
      'Base de cálculo do imposto',
      'Prejuízo a compensar',
      'Alíquota do imposto',
      'Imposto devido',
      'Imposto a pagar'
    ];

    const lines = [headers.join('\t')].concat(
      rows.map(r => [
        r.month,
        r.result.toFixed(2),
        r.previousLoss.toFixed(2),
        r.taxableBase.toFixed(2),
        r.lossToCarry.toFixed(2),
        '20%',
        r.taxDue.toFixed(2),
        r.taxToPay.toFixed(2)
      ].join('\t'))
    );

    navigator.clipboard.writeText(lines.join('\n'));
    setIsCopied(true);
    setToast({ message: 'Tabela de FIIs copiada para o Excel/Conferência!', type: 'success' });
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-zinc-400 font-medium">Calculando posições anuais de fundos imobiliários...</p>
      </div>
    );
  }

  const rows = reports[selectedYear] || [];
  const totalTaxDue = rows.reduce((acc, r) => acc + r.taxDue, 0);
  const yearEndLoss = rows[rows.length - 1]?.lossToCarry || 0;
  const monthsWithSales = rows.filter(r => r.details.length > 0).length;
  const allDetails = rows.flatMap(r => r.details.map(d => ({ ...d, monthName: r.month })));

  const fmt = (v) => v === 0 ? "0,00" : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const cls = (v) => v < 0 ? 'text-red-400 font-mono' : v > 0 ? 'text-emerald-400 font-mono' : 'text-zinc-500 font-mono';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Ficha FIIs e Fiagro</h2>
          <p className="text-zinc-400 text-sm">Resumos anuais de ganhos líquidos ou perdas na alienação de FII/Fiagro</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Ano:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="py-1.5 px-3 bg-black/40 border border-white/5 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 w-28"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCopyTable}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            Copiar Tabela
          </button>
          <button 
            onClick={loadData}
            className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-zinc-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="glass-panel p-8 text-center text-zinc-500 rounded-2xl">
          Sem dados disponíveis para FIIs neste ano.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Meses com Vendas</p>
              <p className="text-xl font-bold text-white mt-1">{monthsWithSales} meses</p>
            </div>
            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Prejuízo a Compensar em DEZ</p>
              <p className={`text-xl font-bold mt-1 ${yearEndLoss > 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                {fmt(yearEndLoss)}
              </p>
            </div>
            <div className="bg-black/20 p-4 rounded-xl border border-white/5 col-span-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Imposto Devido no Ano</p>
              <p className={`text-xl font-extrabold mt-1 ${totalTaxDue > 0 ? 'text-indigo-400' : 'text-zinc-300'}`}>
                {fmt(totalTaxDue)}
              </p>
            </div>
          </div>

          {/* Main Table Grid */}
          <div className="glass-panel rounded-2xl overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-black/40 border-b border-white/5 text-zinc-400 font-semibold">
                    <th className="px-4 py-3 text-left">Mês</th>
                    <th className="px-4 py-3 text-right">Resultado Líquido</th>
                    <th className="px-4 py-3 text-right">Negativo Anterior</th>
                    <th className="px-4 py-3 text-right">Base Cálculo</th>
                    <th className="px-4 py-3 text-right">Prejuízo Compensar</th>
                    <th className="px-4 py-3 text-right">Alíquota</th>
                    <th className="px-4 py-3 text-right">Imposto Devido</th>
                    <th className="px-4 py-3 text-right">Imposto Pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map(r => (
                    <tr key={r.month} className="group hover:bg-indigo-500/[0.06] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                      <td className="px-4 py-3 text-left font-bold text-zinc-300 group-hover:text-white">{r.month}</td>
                      <td className={`px-4 py-3 text-right ${cls(r.result)}`}>{fmt(r.result)}</td>
                      <td className="px-4 py-3 text-right text-red-400/80 font-mono">{fmt(r.previousLoss)}</td>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono group-hover:text-white">{fmt(r.taxableBase)}</td>
                      <td className="px-4 py-3 text-right text-zinc-500 font-mono group-hover:text-zinc-300">{fmt(r.lossToCarry)}</td>
                      <td className="px-4 py-3 text-right text-zinc-400 font-mono">20%</td>
                      <td className="px-4 py-3 text-right text-indigo-400 font-bold font-mono group-hover:text-indigo-300">{fmt(r.taxDue)}</td>
                      <td className="px-4 py-3 text-right text-indigo-400 font-bold font-mono group-hover:text-indigo-300">{fmt(r.taxToPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Details toggle collapsible */}
          <div className="glass-panel p-4 rounded-2xl border border-white/5">
            <button
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="w-full flex items-center justify-between font-bold text-xs text-white"
            >
              <span>Ver Operações Detalhadas de {selectedYear}</span>
              {isDetailsOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>

            {isDetailsOpen && (
              <div className="mt-4 pt-4 border-t border-white/5 overflow-x-auto">
                {allDetails.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">Nenhuma operação neste ano.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-black/30 border-b border-white/5 text-zinc-400 font-semibold">
                        <th className="px-4 py-2.5 text-left">Data</th>
                        <th className="px-4 py-2.5 text-left">Ativo</th>
                        <th className="px-4 py-2.5 text-right">Qtd</th>
                        <th className="px-4 py-2.5 text-right">Venda Bruta</th>
                        <th className="px-4 py-2.5 text-right">Custo Baixado</th>
                        <th className="px-4 py-2.5 text-right">Taxas</th>
                        <th className="px-4 py-2.5 text-right">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {allDetails.map((d, idx) => (
                        <tr key={idx} className="group hover:bg-indigo-500/[0.06] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer">
                          <td className="px-4 py-3 text-left font-mono text-zinc-400 group-hover:text-zinc-200">{d.date.split('-').reverse().join('/')}</td>
                          <td className="px-4 py-3 text-left">
                            <span className="bg-indigo-500/15 group-hover:bg-indigo-500/25 text-indigo-300 font-bold px-2 py-0.5 rounded text-[10px]">{d.ticker}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-300 group-hover:text-white">{d.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-300 group-hover:text-white">{fmt(d.saleRevenue)}</td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-300 group-hover:text-white">{fmt(d.saleCost)}</td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-500 group-hover:text-zinc-300">{fmt(d.taxes)}</td>
                          <td className={`px-4 py-3 text-right font-bold font-mono ${d.result >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt(d.result)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
