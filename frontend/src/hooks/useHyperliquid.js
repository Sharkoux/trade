import { useState, useEffect, useCallback } from 'react';

export default function useHyperliquid(address) {
  const [positions, setPositions] = useState([]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchPositions = useCallback(async () => {
    if (!address) {
      setPositions([]);
      setAccount(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/hyperliquid/positions?address=${address}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch positions');
      }

      setPositions(data.positions || []);
      setAccount(data.account || null);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('Error fetching positions:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Fetch au changement d'adresse
  useEffect(() => {
    if (address) {
      fetchPositions();
    }
  }, [address, fetchPositions]);

  // Rafraîchir automatiquement toutes les 30 secondes si connecté
  useEffect(() => {
    if (!address) return;

    const interval = setInterval(fetchPositions, 30000);
    return () => clearInterval(interval);
  }, [address, fetchPositions]);

  // Calculer les stats
  const stats = {
    totalPositions: positions.length,
    longPositions: positions.filter(p => p.side === 'LONG').length,
    shortPositions: positions.filter(p => p.side === 'SHORT').length,
    totalUnrealizedPnl: account?.unrealizedPnl || 0,
    equity: account?.equity || 0,
    marginUsed: account?.marginUsed || 0,
  };

  // Trouver les positions qui correspondent à une paire de spread
  const findSpreadPositions = (coinA, coinB) => {
    const posA = positions.find(p => p.coin === coinA);
    const posB = positions.find(p => p.coin === coinB);
    return { posA, posB };
  };

  // Vérifier si une position de spread est ouverte
  const hasSpreadPosition = (coinA, coinB) => {
    const { posA, posB } = findSpreadPositions(coinA, coinB);
    return posA && posB && posA.side !== posB.side;
  };

  return {
    positions,
    account,
    stats,
    loading,
    error,
    lastUpdate,
    refresh: fetchPositions,
    findSpreadPositions,
    hasSpreadPosition,
    isConnected: !!address,
  };
}
