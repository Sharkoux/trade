import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import SignalBadge from '@/components/ui/SignalBadge';
import QualityStars from '@/components/ui/QualityStars';
import ScoreBar from '@/components/ui/ScoreBar';
import { sortByScore, filterPairs } from '@/lib/scoring';
import useWatchlist from '@/hooks/useWatchlist';

const UNIVERSES = [
  { id: 'all', label: 'Tout', desc: 'Scan complet' },
  { id: 'l2', label: 'L2', desc: 'Layer 2' },
  { id: 'dex', label: 'DEX', desc: 'Exchanges' },
  { id: 'bluechips', label: 'Majeurs', desc: 'BTC, ETH...' },
  { id: 'defi', label: 'DeFi', desc: 'Lending' },
  { id: 'gaming', label: 'Gaming', desc: 'Metaverse' },
  { id: 'ai', label: 'AI', desc: 'Data & AI' },
  { id: 'meme', label: 'Meme', desc: 'Haute vol.' },
];

export default function ScannerPage() {
  const [universe, setUniverse] = useState('all');
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Filtres
  const [minQuality, setMinQuality] = useState(0);
  const [activeOnly, setActiveOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { toggleWatchlist, isInWatchlist } = useWatchlist();

  const fetchPairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spread/scan?universe=${universe}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur API');

      // Appliquer le scoring intelligent
      const scoredPairs = sortByScore(data.pairs || []);
      setPairs(scoredPairs);
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [universe]);

  useEffect(() => {
    fetchPairs();
  }, [fetchPairs]);

  // Auto-refresh toutes les 60 secondes si actif
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchPairs, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchPairs]);

  // Appliquer les filtres
  const filteredPairs = filterPairs(pairs, {
    minQuality,
    activeOnly,
  });

  const activeCount = pairs.filter(p => Math.abs(p.zScore || 0) > 1.5).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Scanner Automatique</h1>
            <p className="text-gray-400 mt-1">Recherche intelligente des meilleures opportunites</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Mis a jour: {lastUpdate.toLocaleTimeString('fr-FR')}
              </span>
            )}
            <button
              onClick={fetchPairs}
              disabled={loading}
              className="btn btn-secondary flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Scan...' : 'Rafraichir'}
            </button>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Univers */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Univers:</span>
            <div className="flex flex-wrap gap-1">
              {UNIVERSES.map(u => (
                <button
                  key={u.id}
                  onClick={() => setUniverse(u.id)}
                  title={u.desc}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    universe === u.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#1f1f23] text-gray-400 hover:text-white hover:bg-[#2a2a32]'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1" />

          {/* Filtres */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="w-4 h-4 rounded bg-[#1f1f23] border-[#2a2a32] text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400">Signaux actifs</span>
            </label>

            <select
              value={minQuality}
              onChange={(e) => setMinQuality(Number(e.target.value))}
              className="px-3 py-1.5 text-sm rounded-lg"
            >
              <option value={0}>Toutes qualites</option>
              <option value={3}>3+ etoiles</option>
              <option value={4}>4+ etoiles (TOP)</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded bg-[#1f1f23] border-[#2a2a32] text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400">Auto (60s)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-white">{pairs.length}</p>
          <p className="text-xs text-gray-500">Paires scannees</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{activeCount}</p>
          <p className="text-xs text-gray-500">Signaux actifs</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{filteredPairs.filter(p => (p.qualityStars || 0) >= 4).length}</p>
          <p className="text-xs text-gray-500">Paires TOP</p>
        </div>
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        {loading && pairs.length === 0 ? (
          <div className="p-8">
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-12 skeleton" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">
            <p>{error}</p>
            <button onClick={fetchPairs} className="mt-4 btn btn-secondary">
              Reessayer
            </button>
          </div>
        ) : filteredPairs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>Aucune paire ne correspond aux filtres</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0d0d0f] border-b border-[#1f1f23]">
                  <th className="py-3 px-4 text-left w-24">Score</th>
                  <th className="py-3 px-4 text-left">Paire</th>
                  <th className="py-3 px-4 text-left">Qualite</th>
                  <th className="py-3 px-4 text-left">Z-Score</th>
                  <th className="py-3 px-4 text-left">Signal</th>
                  <th className="py-3 px-4 text-left hidden md:table-cell">Win%</th>
                  <th className="py-3 px-4 text-left hidden md:table-cell">Avg</th>
                  <th className="py-3 px-4 text-left hidden lg:table-cell">DD Max</th>
                  <th className="py-3 px-4 text-left hidden lg:table-cell">Gain</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPairs.map((pair, index) => {
                  const z = pair.zScore || 0;
                  const signal = z > 1.5 ? 'SHORT' : z < -1.5 ? 'LONG' : 'NEUTRE';
                  const isActive = signal !== 'NEUTRE';

                  // Calcul du gain potentiel
                  const mean = pair.mean || 0;
                  const std = pair.std || 0;
                  const entryRatio = pair.lastRatio;
                  let gainPct = 0;
                  if (signal === 'SHORT' && entryRatio && mean) {
                    const exitRatio = mean + 0.5 * std;
                    gainPct = ((entryRatio - exitRatio) / entryRatio) * 100;
                  } else if (signal === 'LONG' && entryRatio && mean) {
                    const exitRatio = mean - 0.5 * std;
                    gainPct = ((exitRatio - entryRatio) / entryRatio) * 100;
                  }

                  return (
                    <tr
                      key={pair.pairId}
                      className={`border-b border-[#1f1f23]/50 hover:bg-[#151518] transition-colors ${isActive ? 'bg-[#12121a]' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 text-xs w-5">#{index + 1}</span>
                          <ScoreBar score={pair.score || 0} />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isActive && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                          <span className="font-medium text-white">{pair.coinA}/{pair.coinB}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <QualityStars stars={pair.qualityStars || 0} />
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-mono font-medium ${Math.abs(z) > 1.5 ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {z >= 0 ? '+' : ''}{z.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <SignalBadge signal={signal} />
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className={`${(pair.winRate || 0) >= 0.7 ? 'text-green-400' : (pair.winRate || 0) >= 0.5 ? 'text-gray-300' : 'text-red-400'}`}>
                          {pair.winRate != null ? `${Math.round(pair.winRate * 100)}%` : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className={`${(pair.avgReturn || 0) > 5 ? 'text-green-400' : (pair.avgReturn || 0) > 0 ? 'text-gray-300' : 'text-red-400'}`}>
                          {pair.avgReturn != null ? `${pair.avgReturn > 0 ? '+' : ''}${pair.avgReturn.toFixed(1)}%` : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className={`${(pair.maxDrawdown || 0) <= 25 ? 'text-green-400' : (pair.maxDrawdown || 0) <= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {pair.maxDrawdown != null ? `-${Math.round(pair.maxDrawdown)}%` : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className={`font-medium ${gainPct > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                          {isActive && gainPct > 0 ? `+${gainPct.toFixed(1)}%` : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleWatchlist(pair.pairId)}
                            className={`p-1.5 rounded transition-colors ${
                              isInWatchlist(pair.pairId)
                                ? 'text-yellow-400 bg-yellow-500/10'
                                : 'text-gray-500 hover:text-yellow-400 hover:bg-[#1f1f23]'
                            }`}
                            title={isInWatchlist(pair.pairId) ? 'Retirer' : 'Ajouter'}
                          >
                            <svg className="w-4 h-4" fill={isInWatchlist(pair.pairId) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </button>
                          <Link
                            href={`/pairs/${pair.pairId}`}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              isActive
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30'
                                : 'bg-[#1f1f23] text-gray-400 hover:text-white hover:bg-[#2a2a32]'
                            }`}
                          >
                            {isActive ? 'Trader' : 'Voir'}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legende */}
      <div className="mt-6 card p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Comment fonctionne le score ?</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
          <div>
            <span className="text-green-400 font-medium">80-100</span>
            <p>Excellente opportunite</p>
          </div>
          <div>
            <span className="text-blue-400 font-medium">60-79</span>
            <p>Bonne opportunite</p>
          </div>
          <div>
            <span className="text-yellow-400 font-medium">40-59</span>
            <p>A surveiller</p>
          </div>
          <div>
            <span className="text-red-400 font-medium">0-39</span>
            <p>Risque eleve</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Le score combine: qualite (etoiles), signal actif, win rate, rendement moyen, et penalise le drawdown et le risque.
        </p>
      </div>
    </div>
  );
}
