import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import useHyperliquid from '@/hooks/useHyperliquid';
import StatCard from '@/components/ui/StatCard';
import WalletConnect from '@/components/ui/WalletConnect';
import Disclaimer from '@/components/ui/Disclaimer';

const TABS = [
  { id: 'positions', label: 'Positions Ouvertes' },
  { id: 'history', label: 'Historique' },
];

const PERIODS = [
  { id: 7, label: '7j' },
  { id: 30, label: '30j' },
  { id: 90, label: '90j' },
  { id: null, label: 'Tout' },
];

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { positions, account, stats, loading: positionsLoading, error: positionsError, lastUpdate, refresh } = useHyperliquid(address);

  const [activeTab, setActiveTab] = useState('positions');
  const [trades, setTrades] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [period, setPeriod] = useState(null);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!address) return;

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const res = await fetch(`/api/hyperliquid/history?address=${address}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la recuperation');
      }

      setTrades(data.trades || []);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address && activeTab === 'history') {
      fetchHistory();
    }
  }, [isConnected, address, activeTab, fetchHistory]);

  // Filtrer trades par période
  const filteredTrades = trades.filter(trade => {
    if (!period) return true;
    const tradeDate = new Date(trade.timestamp);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    return tradeDate >= cutoff;
  });

  // Stats historique
  const historyStats = {
    total: filteredTrades.length,
    totalPnl: filteredTrades.reduce((sum, t) => sum + t.closedPnl, 0),
    totalFees: filteredTrades.reduce((sum, t) => sum + t.fee, 0),
    winners: filteredTrades.filter(t => t.closedPnl > 0).length,
    losers: filteredTrades.filter(t => t.closedPnl < 0).length,
    winRate: filteredTrades.length > 0
      ? Math.round((filteredTrades.filter(t => t.closedPnl > 0).length / filteredTrades.length) * 100)
      : 0,
  };

  // Export CSV
  const downloadCsv = () => {
    if (filteredTrades.length === 0) return;

    const headers = ['Date', 'Coin', 'Side', 'Size', 'Price', 'Value', 'Fee', 'PnL'];
    const rows = filteredTrades.map(t => [
      new Date(t.timestamp).toISOString(),
      t.coin,
      t.side,
      t.size,
      t.price,
      t.value.toFixed(2),
      t.fee.toFixed(4),
      t.closedPnl.toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hyperliquid-history-${address.slice(0, 8)}.csv`;
    a.click();
  };

  if (!isConnected) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          <p className="text-gray-400 mt-1">Visualisez vos positions et historique Hyperliquid</p>
        </div>

        <div className="card p-12 text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Connectez votre wallet</h3>
          <p className="text-gray-500 mb-6">
            Pour voir vos positions et historique Hyperliquid, connectez votre wallet en lecture seule.
          </p>

          <div className="max-w-xs mx-auto">
            <WalletConnect />
          </div>

          <div className="mt-6 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-start gap-2 text-left">
              <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="text-sm text-green-400 font-medium">100% Lecture seule</p>
                <p className="text-xs text-gray-400 mt-1">
                  SpreadLab ne peut pas executer de transactions ou acceder a vos fonds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Portfolio</h1>
            <p className="text-gray-400 mt-1">
              Votre compte Hyperliquid
              {lastUpdate && (
                <span className="ml-2 text-xs text-gray-500">
                  (MAJ: {lastUpdate.toLocaleTimeString('fr-FR')})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'history' && (
              <button
                onClick={downloadCsv}
                disabled={filteredTrades.length === 0}
                className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV
              </button>
            )}
            <button
              onClick={activeTab === 'positions' ? refresh : fetchHistory}
              disabled={positionsLoading || historyLoading}
              className="btn btn-secondary flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${(positionsLoading || historyLoading) ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Rafraichir
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards - Positions */}
      {activeTab === 'positions' && account && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Equity"
            value={`$${account.equity.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`}
            color="blue"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="PnL Non Realise"
            value={`${account.unrealizedPnl >= 0 ? '+' : ''}$${account.unrealizedPnl.toFixed(2)}`}
            color={account.unrealizedPnl >= 0 ? 'green' : 'red'}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
          <StatCard
            title="Marge Utilisee"
            value={`$${account.marginUsed.toFixed(0)}`}
            color="yellow"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            title="Positions"
            value={stats.totalPositions}
            subtitle={`${stats.longPositions}L / ${stats.shortPositions}S`}
            color="purple"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
        </div>
      )}

      {/* Stats Cards - History */}
      {activeTab === 'history' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Trades"
            value={historyStats.total}
            color="blue"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
          <StatCard
            title="Win Rate"
            value={`${historyStats.winRate}%`}
            subtitle={`${historyStats.winners}W / ${historyStats.losers}L`}
            color={historyStats.winRate >= 50 ? 'green' : 'red'}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="PnL Realise"
            value={`${historyStats.totalPnl >= 0 ? '+' : ''}$${historyStats.totalPnl.toFixed(2)}`}
            color={historyStats.totalPnl >= 0 ? 'green' : 'red'}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="Frais Totaux"
            value={`$${historyStats.totalFees.toFixed(2)}`}
            color="yellow"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Errors */}
      {positionsError && activeTab === 'positions' && (
        <div className="card p-4 mb-6 bg-red-500/10 border-red-500/30">
          <p className="text-red-400 text-sm">{positionsError}</p>
        </div>
      )}
      {historyError && activeTab === 'history' && (
        <div className="card p-4 mb-6 bg-red-500/10 border-red-500/30">
          <p className="text-red-400 text-sm">{historyError}</p>
        </div>
      )}

      {/* Tabs + Content */}
      <div className="card overflow-hidden">
        {/* Tab Header */}
        <div className="flex border-b border-[#1f1f23]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-white bg-[#151518]'
                  : 'text-gray-400 hover:text-white hover:bg-[#0d0d0f]'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          ))}
        </div>

        {/* Period Filter for History */}
        {activeTab === 'history' && (
          <div className="p-4 border-b border-[#1f1f23] flex items-center gap-2">
            <span className="text-sm text-gray-400">Periode:</span>
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.id || 'all'}
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    period === p.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#1f1f23] text-gray-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Positions Tab Content */}
        {activeTab === 'positions' && (
          <>
            {positionsLoading && positions.length === 0 ? (
              <div className="p-8">
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 skeleton" />
                  ))}
                </div>
              </div>
            ) : positions.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1f1f23] flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-gray-500">Aucune position ouverte</p>
                <Link href="/scanner" className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-sm">
                  Scanner les opportunites →
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0d0d0f] border-b border-[#1f1f23]">
                    <th className="py-3 px-4 text-left">Asset</th>
                    <th className="py-3 px-4 text-left">Side</th>
                    <th className="py-3 px-4 text-right">Taille</th>
                    <th className="py-3 px-4 text-right">Entree</th>
                    <th className="py-3 px-4 text-right hidden md:table-cell">Mark</th>
                    <th className="py-3 px-4 text-right hidden md:table-cell">Liq.</th>
                    <th className="py-3 px-4 text-right">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, i) => (
                    <tr key={i} className="border-b border-[#1f1f23]/50 hover:bg-[#151518] transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-medium text-white">{pos.coin}</span>
                        <span className="text-xs text-gray-500 ml-2">{pos.leverage}x</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          pos.side === 'LONG' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {pos.side}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-gray-300">
                        {Math.abs(pos.size).toFixed(4)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-gray-400">
                        ${pos.entryPrice.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-gray-400 hidden md:table-cell">
                        ${pos.markPrice.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-red-400/70 hidden md:table-cell">
                        {pos.liquidationPrice ? `$${pos.liquidationPrice.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`font-semibold ${pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* History Tab Content */}
        {activeTab === 'history' && (
          <>
            {historyLoading && filteredTrades.length === 0 ? (
              <div className="p-8">
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 skeleton" />
                  ))}
                </div>
              </div>
            ) : filteredTrades.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1f1f23] flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-500">Aucun trade sur cette periode</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#0d0d0f] border-b border-[#1f1f23]">
                      <th className="py-3 px-4 text-left">Date</th>
                      <th className="py-3 px-4 text-left">Coin</th>
                      <th className="py-3 px-4 text-left">Side</th>
                      <th className="py-3 px-4 text-right">Taille</th>
                      <th className="py-3 px-4 text-right hidden md:table-cell">Prix</th>
                      <th className="py-3 px-4 text-right hidden lg:table-cell">Fee</th>
                      <th className="py-3 px-4 text-right">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.slice(0, 100).map((trade, i) => {
                      const isProfit = trade.closedPnl > 0;
                      return (
                        <tr key={trade.id || i} className="border-b border-[#1f1f23]/50 hover:bg-[#151518] transition-colors">
                          <td className="py-3 px-4">
                            <div className="text-gray-300 text-sm">
                              {new Date(trade.timestamp).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </div>
                            <div className="text-gray-600 text-xs">
                              {new Date(trade.timestamp).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-white">{trade.coin}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              trade.side === 'B'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {trade.side === 'B' ? 'BUY' : 'SELL'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-gray-300">
                            {trade.size.toFixed(4)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-gray-400 hidden md:table-cell">
                            ${trade.price.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-gray-500 hidden lg:table-cell">
                            ${trade.fee.toFixed(4)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {trade.closedPnl !== 0 ? (
                              <span className={`font-semibold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                {isProfit ? '+' : ''}${trade.closedPnl.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredTrades.length > 100 && (
                  <div className="p-4 text-center border-t border-[#1f1f23]">
                    <p className="text-gray-500 text-sm">
                      Affichage des 100 premiers trades sur {filteredTrades.length}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Disclaimer */}
      <Disclaimer variant="footer" />
    </div>
  );
}
