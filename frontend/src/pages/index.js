import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatCard from '@/components/ui/StatCard';
import SignalBadge from '@/components/ui/SignalBadge';
import QualityStars from '@/components/ui/QualityStars';
import ScoreBar from '@/components/ui/ScoreBar';
import { sortByScore, calculateGlobalStats } from '@/lib/scoring';
import useWatchlist from '@/hooks/useWatchlist';

export default function DashboardPage() {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { watchlist } = useWatchlist();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Scanner toutes les paires pour avoir une vue globale
        const res = await fetch('/api/spread/scan?universe=all');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur API');

        // Trier par score intelligent
        const scoredPairs = sortByScore(data.pairs || []);
        setPairs(scoredPairs);
      } catch (e) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const globalStats = calculateGlobalStats(pairs);
  const topPairs = pairs.slice(0, 5);
  const activePairs = pairs.filter(p => Math.abs(p.zScore || 0) > 1.5).slice(0, 5);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Vue d'ensemble de vos opportunites de spread trading</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Signaux Actifs"
          value={globalStats.activeSignals}
          subtitle="Opportunites detectees"
          color="yellow"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatCard
          title="Meilleure Paire"
          value={globalStats.bestPair}
          subtitle={`Score: ${globalStats.topScore}`}
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          }
        />
        <StatCard
          title="Win Rate Global"
          value={`${globalStats.avgWinRate}%`}
          subtitle="Sur le top 10"
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatCard
          title="Gain Moyen"
          value={`+${globalStats.avgReturn}%`}
          subtitle="Par trade"
          color="purple"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Opportunites */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Top 5 Opportunites</h2>
            <Link href="/scanner" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              Voir tout →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 skeleton" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400">
              <p>{error}</p>
            </div>
          ) : topPairs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Aucune paire disponible</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1f1f23]">
                    <th className="py-3 px-2 text-left">Score</th>
                    <th className="py-3 px-2 text-left">Paire</th>
                    <th className="py-3 px-2 text-left">Qualite</th>
                    <th className="py-3 px-2 text-left">Signal</th>
                    <th className="py-3 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {topPairs.map((pair, index) => {
                    const z = pair.zScore || 0;
                    const signal = z > 1.5 ? 'SHORT' : z < -1.5 ? 'LONG' : 'NEUTRE';
                    const isActive = signal !== 'NEUTRE';

                    return (
                      <tr key={pair.pairId} className="border-b border-[#1f1f23]/50 hover:bg-[#151518] transition-colors">
                        <td className="py-3 px-2 w-24">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-sm">#{index + 1}</span>
                            <ScoreBar score={pair.score} showValue />
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {isActive && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                            <span className="font-medium text-white">{pair.coinA}/{pair.coinB}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <QualityStars stars={pair.qualityStars || 0} />
                        </td>
                        <td className="py-3 px-2">
                          <SignalBadge signal={signal} />
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Link
                            href={`/pairs/${pair.pairId}`}
                            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              isActive
                                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                : 'bg-[#1f1f23] text-gray-400 hover:text-white'
                            }`}
                          >
                            {isActive ? 'Trader' : 'Voir'}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar - Signaux Actifs + Stats */}
        <div className="space-y-6">
          {/* Signaux Actifs */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              Signaux Actifs
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 skeleton" />
                ))}
              </div>
            ) : activePairs.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                <p>Aucun signal actif</p>
                <p className="text-xs mt-1">Les signaux apparaissent quand |z| &gt; 1.5</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activePairs.map(pair => {
                  const z = pair.zScore || 0;
                  const signal = z > 1.5 ? 'SHORT' : 'LONG';

                  return (
                    <Link
                      key={pair.pairId}
                      href={`/pairs/${pair.pairId}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#151518] hover:bg-[#1a1a1e] transition-colors"
                    >
                      <div>
                        <span className="font-medium text-white">{pair.coinA}/{pair.coinB}</span>
                        <span className="ml-2 text-xs text-gray-500">z={z.toFixed(2)}</span>
                      </div>
                      <SignalBadge signal={signal} size="sm" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mon Compte */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Mon Compte</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Watchlist</span>
                <span className="font-medium text-white">{watchlist.length} paires</span>
              </div>
              <p className="text-sm text-gray-500">
                Connectez votre wallet pour voir vos positions et historique Hyperliquid.
              </p>
            </div>
            <Link
              href="/portfolio"
              className="mt-4 block text-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Voir mon portfolio →
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Actions Rapides</h3>
            <div className="space-y-2">
              <Link
                href="/bot"
                className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">Bot Trading Auto</span>
              </Link>
              <Link
                href="/scanner"
                className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="font-medium">Scanner les paires</span>
              </Link>
              <Link
                href="/watchlist"
                className="flex items-center gap-3 p-3 rounded-lg bg-[#151518] hover:bg-[#1a1a1e] text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span className="font-medium">Ma Watchlist</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
