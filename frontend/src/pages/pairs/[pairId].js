// pages/pairs/[pairId].js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import PairChart from '../../components/PairChart';

export default function PairDetailPage() {
  const router = useRouter();
  const { pairId } = router.query;

  const [timeframe, setTimeframe] = useState('1y');
  const [backtest, setBacktest] = useState(null);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [zEnter, setZEnter] = useState(1.5);
  const [zExit, setZExit] = useState(0.5);
  const [positionSize, setPositionSize] = useState(1000);

  useEffect(() => {
    if (!pairId) return;
    const [coinA, coinB] = pairId.toUpperCase().split('-');

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          coinA,
          coinB,
          timeframe,
          zEnter: String(zEnter),
          zExit: String(zExit),
          positionSize: String(positionSize),
        });
        const res = await fetch(`/api/spread/backtest?` + params.toString());
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur API backtest');

        setSeries(data.series || []);          // historique ratio + z
        setBacktest(data.backtest || null);    // résultat PnL
      } catch (e) {
        console.error(e);
        setError('Erreur lors du backtest');
        setSeries([]);
        setBacktest(null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [pairId, timeframe, zEnter, zExit, positionSize]);

  if (!pairId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        Chargement…
      </div>
    );
  }

  const [coinA, coinB] = pairId.toUpperCase().split('-');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Spread {coinA} / {coinB}
            </h1>
            <p className="text-slate-400 text-sm">
              Historique, suggestions de zones d&apos;entrée et backtest simple de mean reversion.
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-xs md:text-sm px-3 py-1.5 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            ⬅ Retour dashboard
          </button>
        </header>

        {/* Paramètres backtest */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-5 text-xs md:text-sm flex flex-col gap-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Période :</span>
              {['1m', '3m', '6m', '1y'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={
                    timeframe === tf
                      ? 'px-2 py-1 rounded-md bg-sky-500 text-slate-900 text-xs font-semibold'
                      : 'px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-xs hover:bg-slate-800'
                  }
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col">
                <span className="text-slate-400 text-[11px]">zEnter</span>
                <input
                  type="number"
                  step="0.1"
                  value={zEnter}
                  onChange={(e) => setZEnter(parseFloat(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs outline-none focus:border-sky-500 w-20"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-slate-400 text-[11px]">zExit</span>
                <input
                  type="number"
                  step="0.1"
                  value={zExit}
                  onChange={(e) => setZExit(parseFloat(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs outline-none focus:border-sky-500 w-20"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-slate-400 text-[11px]">Taille position (USDC)</span>
                <input
                  type="number"
                  value={positionSize}
                  onChange={(e) => setPositionSize(parseFloat(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs outline-none focus:border-sky-500 w-24"
                />
              </label>
            </div>
          </div>

          {loading && <p className="text-slate-400">Backtest en cours…</p>}
          {error && <p className="text-red-400">{error}</p>}
        </div>

        {/* Layout chart + résultats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-5">
              <PairChart pairId={pairId} coinA={coinA} coinB={coinB} series={series} />
            </div>
          </div>

          {/* Résumé backtest */}
          <div className="flex flex-col gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-sm">
              <h2 className="text-lg font-semibold mb-2">📈 Résumé du backtest</h2>
              {backtest ? (
                <div className="space-y-1 text-xs md:text-sm">
                  <p>
                    <span className="text-slate-400">Nombre de trades :</span>{' '}
                    <span className="text-slate-100">{backtest.nbTrades}</span>
                  </p>
                  <p>
                    <span className="text-slate-400">PnL total :</span>{' '}
                    <span
                      className={
                        backtest.totalPnl >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'
                      }
                    >
                      {backtest.totalPnl.toFixed(2)} USDC
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-400">Rendement moyen par trade :</span>{' '}
                    <span
                      className={
                        backtest.avgPct >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'
                      }
                    >
                      {(backtest.avgPct * 100).toFixed(2)} %
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Ajuste les paramètres et attends le résultat du backtest.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
