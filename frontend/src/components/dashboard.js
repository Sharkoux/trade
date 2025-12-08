// pages/index.js
import { useEffect, useState } from 'react';
import Link from 'next/link';
import GlossarySpread from '../components/GlossarySpread';


export default function DashboardPage() {
  const [universe, setUniverse] = useState('l2');
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/spread/scan?universe=${universe}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur API scan');
        setPairs(data.pairs || []);
      } catch (e) {
        console.error(e);
        setError('Impossible de charger les paires de spread');
        setPairs([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [universe]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">Spread Trading Dashboard</h1>
          <p className="text-slate-400 text-sm">
            Scanner de paires corrélées (Hyperliquid) pour stratégie de spread / mean reversion.
          </p>
        </header>

        {/* Sélecteur d'univers */}
        <div className="flex items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <span className="text-slate-400">Univers :</span>
            <button
              onClick={() => setUniverse('l2')}
              className={
                universe === 'l2'
                  ? 'px-2 py-1 rounded-md bg-sky-500 text-slate-900 text-xs font-semibold'
                  : 'px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-xs hover:bg-slate-800'
              }
            >
              L2
            </button>
            <button
              onClick={() => setUniverse('dex')}
              className={
                universe === 'dex'
                  ? 'px-2 py-1 rounded-md bg-sky-500 text-slate-900 text-xs font-semibold'
                  : 'px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-xs hover:bg-slate-800'
              }
            >
              DEX
            </button>
            <button
              onClick={() => setUniverse('bluechips')}
              className={
                universe === 'bluechips'
                  ? 'px-2 py-1 rounded-md bg-sky-500 text-slate-900 text-xs font-semibold'
                  : 'px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-xs hover:bg-slate-800'
              }
            >
              Bluechips
            </button>
          </div>
          {loading && <span className="text-xs text-slate-400">Scan en cours…</span>}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>

        {/* Tableau des paires proposées par /api/spread/scan */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-5">
          <h2 className="text-lg font-semibold mb-3">🧮 Paires de spread suggérées</h2>

          {pairs.length === 0 && !loading && !error && (
            <p className="text-xs text-slate-500">
              Aucune paire disponible pour cet univers (ou erreur côté API).
            </p>
          )}

          {pairs.length > 0 && (
            <div className="overflow-x-auto text-xs md:text-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-left py-2">Paire</th>
                    <th className="text-left py-2">Score</th>
                    <th className="text-left py-2">Corrélation</th>
                    <th className="text-left py-2">Réversion</th>
                    <th className="text-left py-2">Ratio actuel</th>
                    <th className="text-left py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((p) => (
                    <tr key={p.pairId} className="border-b border-slate-900/60">
                      <td className="py-2 font-medium">
                        {p.coinA} / {p.coinB}
                      </td>
                      <td className="py-2 text-slate-100">
                        {p.score ? (p.score * 100).toFixed(1) : '—'}
                      </td>
                      <td className="py-2 text-slate-300">
                        {p.corr !== undefined ? p.corr.toFixed(2) : '—'}
                      </td>
                      <td className="py-2 text-slate-300">
                        {p.reversionRate !== undefined ? (p.reversionRate * 100).toFixed(0) + ' %' : '—'}
                      </td>
                      <td className="py-2 text-slate-300">
                        {p.lastRatio !== undefined ? p.lastRatio.toFixed(4) : '—'}
                      </td>
                      <td className="py-2">
                        <Link
                          href={`/pairs/${p.pairId}`}
                          className="inline-flex items-center text-[11px] md:text-xs px-3 py-1.5 rounded-md border border-slate-700 hover:bg-slate-800"
                        >
                          Ouvrir la fiche
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Légende des colonnes */}
<p className="mt-3 text-[11px] md:text-xs text-slate-500">
  <span className="font-semibold">Score</span> : plus il est proche de 100, plus la paire est
  intéressante pour du spread (bonne corrélation + bon taux de retour vers la moyenne).{' '}
  <span className="font-semibold">Réversion</span> : pourcentage de gros écarts de ratio qui ont
  été suivis par un retour vers la moyenne.{' '}
  <span className="font-semibold">Ratio actuel</span> : prix A / prix B au dernier point de l&apos;historique.
</p>

            </div>
          )}
        </section>
        <GlossarySpread />
      </div>
      
    </div>
  );
}
