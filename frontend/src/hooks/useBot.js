// Hook pour gérer le bot de trading
import { useState, useEffect, useCallback } from 'react';

export default function useBot(options = {}) {
  const { autoRefresh = true, refreshInterval = 10000 } = options;

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger le statut
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/status');
      const data = await res.json();

      if (data.success) {
        setStatus(data);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Contrôler le bot
  const control = useCallback(async (action, params = {}) => {
    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      });
      const data = await res.json();

      if (data.success) {
        await fetchStatus();
      }

      return data;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [fetchStatus]);

  // Raccourcis pour les actions courantes
  const start = useCallback(() => control('start'), [control]);
  const stop = useCallback(() => control('stop'), [control]);
  const reset = useCallback((balance = 1000) => control('reset', { initialBalance: balance }), [control]);
  const updateConfig = useCallback((config) => control('config', { config }), [control]);
  const closeSpread = useCallback((spreadId) => control('close-spread', { spreadId }), [control]);
  const closeAll = useCallback(() => control('close-all'), [control]);

  // Exécuter un cycle manuellement
  const runCycle = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/run', { method: 'POST' });
      const data = await res.json();
      await fetchStatus();
      return data;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [fetchStatus]);

  // Scanner les opportunités
  const scan = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/scan');
      return res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    fetchStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, autoRefresh, refreshInterval]);

  return {
    // État
    status,
    loading,
    error,
    isRunning: status?.bot?.isRunning || false,
    mode: status?.config?.mode || 'paper',
    config: status?.config || {},
    positions: status?.positions?.open || [],
    stats: status?.stats || {},
    paper: status?.paper || {},
    history: status?.recentHistory || [],

    // Actions
    fetchStatus,
    start,
    stop,
    reset,
    updateConfig,
    closeSpread,
    closeAll,
    runCycle,
    scan,
    control,
  };
}
