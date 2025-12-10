import { useState, useEffect } from 'react';

const STORAGE_KEY = 'spreadlab_trade_history';

export default function useTradeHistory() {
  const [trades, setTrades] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Charger depuis localStorage au montage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTrades(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Erreur chargement historique:', e);
    }
    setIsLoaded(true);
  }, []);

  // Sauvegarder dans localStorage quand les trades changent
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
      } catch (e) {
        console.error('Erreur sauvegarde historique:', e);
      }
    }
  }, [trades, isLoaded]);

  const addTrade = (trade) => {
    const newTrade = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      ...trade,
    };
    setTrades(prev => [newTrade, ...prev]);
    return newTrade;
  };

  const removeTrade = (tradeId) => {
    setTrades(prev => prev.filter(t => t.id !== tradeId));
  };

  const clearHistory = () => {
    setTrades([]);
  };

  // Filtrer par periode
  const getTradesByPeriod = (days) => {
    if (!days) return trades;
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return trades.filter(t => t.timestamp >= cutoff);
  };

  // Statistiques
  const getStats = (filteredTrades = trades) => {
    if (filteredTrades.length === 0) {
      return {
        total: 0,
        winners: 0,
        losers: 0,
        winRate: 0,
        totalPnl: 0,
        avgPnl: 0,
      };
    }

    const winners = filteredTrades.filter(t => t.pnl > 0);
    const losers = filteredTrades.filter(t => t.pnl <= 0);
    const totalPnl = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    return {
      total: filteredTrades.length,
      winners: winners.length,
      losers: losers.length,
      winRate: Math.round((winners.length / filteredTrades.length) * 100),
      totalPnl,
      avgPnl: totalPnl / filteredTrades.length,
    };
  };

  // Export CSV
  const exportToCsv = () => {
    if (trades.length === 0) return null;

    const headers = ['Date', 'Paire', 'Type', 'Entree', 'Sortie', 'Duree (j)', 'PnL ($)', 'PnL (%)'];
    const rows = trades.map(t => [
      new Date(t.timestamp).toLocaleDateString('fr-FR'),
      t.pair || '-',
      t.type || '-',
      t.entryPrice?.toFixed(4) || '-',
      t.exitPrice?.toFixed(4) || '-',
      t.duration || '-',
      t.pnl?.toFixed(2) || '0',
      t.pnlPercent?.toFixed(2) || '0',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    return csv;
  };

  const downloadCsv = () => {
    const csv = exportToCsv();
    if (!csv) return;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `spreadlab_trades_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return {
    trades,
    isLoaded,
    addTrade,
    removeTrade,
    clearHistory,
    getTradesByPeriod,
    getStats,
    exportToCsv,
    downloadCsv,
    count: trades.length,
  };
}
