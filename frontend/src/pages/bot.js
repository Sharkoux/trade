// Page de contrôle du Bot de Trading Automatique
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import StatCard from '@/components/ui/StatCard';
import SignalBadge from '@/components/ui/SignalBadge';
import QualityStars from '@/components/ui/QualityStars';

// Composant de configuration Telegram
function TelegramConfig({ addLog }) {
  const [telegramConfig, setTelegramConfig] = useState({
    enabled: false,
    botToken: '',
    chatId: '',
  });
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);

  // Charger la config Telegram
  useEffect(() => {
    fetch('/api/bot/telegram')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTelegramConfig(prev => ({
            ...prev,
            enabled: data.telegram.enabled,
            chatId: data.telegram.chatId || '',
          }));
          setConfigured(!!data.telegram.botToken);
        }
      })
      .catch(() => {});
  }, []);

  const testConnection = async () => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      addLog('Token et Chat ID requis', 'error');
      return;
    }

    setTesting(true);
    try {
      const res = await fetch('/api/bot/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          botToken: telegramConfig.botToken,
          chatId: telegramConfig.chatId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('Telegram: Connexion reussie !', 'success');
      } else {
        addLog('Telegram: ' + (data.error || 'Echec'), 'error');
      }
    } catch (e) {
      addLog('Telegram: Erreur - ' + e.message, 'error');
    }
    setTesting(false);
  };

  const saveConfig = async () => {
    try {
      const res = await fetch('/api/bot/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'configure',
          enabled: telegramConfig.enabled,
          botToken: telegramConfig.botToken || undefined,
          chatId: telegramConfig.chatId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('Telegram: Configuration sauvegardee', 'success');
        setConfigured(!!telegramConfig.botToken);
      } else {
        addLog('Telegram: ' + (data.error || 'Erreur'), 'error');
      }
    } catch (e) {
      addLog('Telegram: Erreur - ' + e.message, 'error');
    }
  };

  const sendStatus = async () => {
    try {
      const res = await fetch('/api/bot/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-status' }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('Telegram: Rapport envoye', 'success');
      } else {
        addLog('Telegram: ' + (data.error || 'Erreur'), 'error');
      }
    } catch (e) {
      addLog('Telegram: Erreur - ' + e.message, 'error');
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
          </svg>
          Telegram
        </h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={telegramConfig.enabled}
            onChange={e => setTelegramConfig({ ...telegramConfig, enabled: e.target.checked })}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-gray-400">Activer</span>
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Bot Token</label>
          <div className="flex gap-2">
            <input
              type={showToken ? 'text' : 'password'}
              value={telegramConfig.botToken}
              onChange={e => setTelegramConfig({ ...telegramConfig, botToken: e.target.value })}
              placeholder={configured ? '***configure***' : 'Coller le token du BotFather'}
              className="flex-1 bg-[#1f1f23] border border-[#2a2a2e] rounded-lg p-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="px-3 bg-[#1f1f23] rounded-lg text-gray-400 hover:text-white"
            >
              {showToken ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Chat ID</label>
          <input
            type="text"
            value={telegramConfig.chatId}
            onChange={e => setTelegramConfig({ ...telegramConfig, chatId: e.target.value })}
            placeholder="Votre Chat ID (via @userinfobot)"
            className="w-full bg-[#1f1f23] border border-[#2a2a2e] rounded-lg p-2 text-white text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={testConnection}
            disabled={testing}
            className="flex-1 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
          >
            {testing ? 'Test...' : 'Tester'}
          </button>
          <button
            onClick={saveConfig}
            className="flex-1 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
          >
            Sauvegarder
          </button>
        </div>

        {configured && telegramConfig.enabled && (
          <button
            onClick={sendStatus}
            className="w-full py-2 bg-[#1f1f23] rounded-lg text-gray-400 text-sm hover:text-white hover:bg-[#2a2a2e] transition-colors"
          >
            Envoyer rapport maintenant
          </button>
        )}

        <p className="text-xs text-gray-600 pt-2">
          1. Ouvrez Telegram, cherchez @BotFather<br/>
          2. Envoyez /newbot et suivez les instructions<br/>
          3. Copiez le token et collez-le ci-dessus<br/>
          4. Cherchez @userinfobot pour obtenir votre Chat ID
        </p>
      </div>
    </div>
  );
}

// Composant de configuration API Keys Hyperliquid
function ApiKeysConfig({ addLog, mode, onModeChange }) {
  const [apiConfig, setApiConfig] = useState({
    apiKey: '',
    apiSecret: '',
    walletAddress: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [liveBalance, setLiveBalance] = useState(null);

  // Charger la config API
  useEffect(() => {
    fetch('/api/bot/api-keys')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setConfigured(data.apiKeys.configured);
          if (data.apiKeys.walletAddress) {
            setApiConfig(prev => ({
              ...prev,
              walletAddress: data.apiKeys.walletAddress,
            }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const testConnection = async () => {
    if (!apiConfig.apiKey || !apiConfig.apiSecret || !apiConfig.walletAddress) {
      addLog('API Key, Secret et Wallet Address requis', 'error');
      return;
    }

    setTesting(true);
    try {
      const res = await fetch('/api/bot/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          apiKey: apiConfig.apiKey,
          apiSecret: apiConfig.apiSecret,
          walletAddress: apiConfig.walletAddress,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`API Keys: ${data.message}`, 'success');
        setLiveBalance(data.balance);
      } else {
        addLog('API Keys: ' + (data.error || 'Echec connexion'), 'error');
      }
    } catch (e) {
      addLog('API Keys: Erreur - ' + e.message, 'error');
    }
    setTesting(false);
  };

  const saveConfig = async () => {
    if (!apiConfig.apiKey || !apiConfig.apiSecret || !apiConfig.walletAddress) {
      addLog('Tous les champs sont requis', 'error');
      return;
    }

    try {
      const res = await fetch('/api/bot/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'configure',
          apiKey: apiConfig.apiKey,
          apiSecret: apiConfig.apiSecret,
          walletAddress: apiConfig.walletAddress,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('API Keys: Configuration sauvegardee', 'success');
        setConfigured(true);
      } else {
        addLog('API Keys: ' + (data.error || 'Erreur'), 'error');
      }
    } catch (e) {
      addLog('API Keys: Erreur - ' + e.message, 'error');
    }
  };

  const removeConfig = async () => {
    try {
      const res = await fetch('/api/bot/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove' }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('API Keys: Configuration supprimee', 'warning');
        setConfigured(false);
        setLiveBalance(null);
        setApiConfig({ apiKey: '', apiSecret: '', walletAddress: '' });
        onModeChange('paper');
      }
    } catch (e) {
      addLog('API Keys: Erreur - ' + e.message, 'error');
    }
  };

  const setMode = async (newMode) => {
    try {
      const res = await fetch('/api/bot/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-mode', mode: newMode }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Mode ${newMode.toUpperCase()} active`, newMode === 'live' ? 'warning' : 'info');
        onModeChange(newMode);
      } else {
        addLog('API Keys: ' + (data.error || 'Erreur'), 'error');
      }
    } catch (e) {
      addLog('API Keys: Erreur - ' + e.message, 'error');
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          API Keys Hyperliquid
        </h2>
        {configured && (
          <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Configure</span>
        )}
      </div>

      {/* Mode Toggle */}
      {configured && (
        <div className="mb-4 p-3 rounded-lg bg-[#151518] border border-[#1f1f23]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Mode de trading</span>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('paper')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  mode === 'paper'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-[#1f1f23] text-gray-500 hover:text-gray-400'
                }`}
              >
                Paper
              </button>
              <button
                onClick={() => setMode('live')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  mode === 'live'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-[#1f1f23] text-gray-500 hover:text-gray-400'
                }`}
              >
                Live
              </button>
            </div>
          </div>

          {liveBalance && (
            <div className="mt-3 pt-3 border-t border-[#1f1f23]">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Balance Live:</span>
                <span className="text-white font-medium">{liveBalance.equity?.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">Disponible:</span>
                <span className="text-gray-400">{liveBalance.available?.toFixed(2)} USDC</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Wallet Address</label>
          <input
            type="text"
            value={apiConfig.walletAddress}
            onChange={e => setApiConfig({ ...apiConfig, walletAddress: e.target.value })}
            placeholder="0x..."
            className="w-full bg-[#1f1f23] border border-[#2a2a2e] rounded-lg p-2 text-white text-sm focus:border-orange-500 focus:outline-none font-mono"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">API Key</label>
          <input
            type="text"
            value={apiConfig.apiKey}
            onChange={e => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
            placeholder={configured ? '***configure***' : 'Votre API Key'}
            className="w-full bg-[#1f1f23] border border-[#2a2a2e] rounded-lg p-2 text-white text-sm focus:border-orange-500 focus:outline-none font-mono"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">API Secret</label>
          <div className="flex gap-2">
            <input
              type={showSecret ? 'text' : 'password'}
              value={apiConfig.apiSecret}
              onChange={e => setApiConfig({ ...apiConfig, apiSecret: e.target.value })}
              placeholder={configured ? '***configure***' : 'Votre API Secret'}
              className="flex-1 bg-[#1f1f23] border border-[#2a2a2e] rounded-lg p-2 text-white text-sm focus:border-orange-500 focus:outline-none font-mono"
            />
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="px-3 bg-[#1f1f23] rounded-lg text-gray-400 hover:text-white"
            >
              {showSecret ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={testConnection}
            disabled={testing}
            className="flex-1 py-2 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-lg text-sm hover:bg-orange-500/30 disabled:opacity-50 transition-colors"
          >
            {testing ? 'Test...' : 'Tester'}
          </button>
          <button
            onClick={saveConfig}
            className="flex-1 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
          >
            Sauvegarder
          </button>
        </div>

        {configured && (
          <button
            onClick={removeConfig}
            className="w-full py-2 bg-red-500/10 rounded-lg text-red-400 text-sm hover:bg-red-500/20 transition-colors"
          >
            Supprimer les cles
          </button>
        )}

        <div className="pt-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
          <p className="text-xs text-orange-400/80">
            <strong>Important:</strong> Utilisez un wallet dedie avec des fonds limites.<br/>
            Ne mettez JAMAIS les cles de votre wallet principal.
          </p>
        </div>

        <p className="text-xs text-gray-600">
          1. Allez sur app.hyperliquid.xyz<br/>
          2. Settings &gt; API &gt; Create API Key<br/>
          3. Cochez "Trading" dans les permissions<br/>
          4. Copiez la Key et le Secret
        </p>
      </div>
    </div>
  );
}

export default function BotPage() {
  const [status, setStatus] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);

  // Configuration editable
  const [config, setConfig] = useState({
    mode: 'paper',
    maxPositionUSD: 100,
    maxConcurrentSpreads: 3,
    minQualityStars: 4,
    minWinRate: 0.6,
    zEntryThreshold: 1.5,
    zExitThreshold: 0.5,
    stopLossPercent: 10,
    activeUniverses: ['l2', 'bluechips', 'defi'],
  });

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-50), { timestamp, message, type }]);
  }, []);

  // Charger le statut initial
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/status');
      const data = await res.json();
      if (data.success) {
        setStatus(data);
        setRunning(data.bot.isRunning);
        if (data.config) {
          setConfig(prev => ({ ...prev, ...data.config }));
        }
      }
    } catch (e) {
      addLog('Erreur chargement statut: ' + e.message, 'error');
    }
    setLoading(false);
  }, [addLog]);

  // Scanner les opportunites
  const scanOpportunities = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/scan');
      const data = await res.json();
      if (data.success) {
        setOpportunities(data.opportunities || []);
        addLog(`Scan: ${data.scan.available} opportunites trouvees`, 'info');
      }
    } catch (e) {
      addLog('Erreur scan: ' + e.message, 'error');
    }
  }, [addLog]);

  // Controler le bot
  const controlBot = async (action, params = {}) => {
    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      });
      const data = await res.json();

      if (data.success) {
        addLog(`Action "${action}" executee`, 'success');
        await fetchStatus();
      } else {
        addLog(`Erreur: ${data.error}`, 'error');
      }

      return data;
    } catch (e) {
      addLog('Erreur controle: ' + e.message, 'error');
    }
  };

  // Executer un cycle
  const runCycle = async () => {
    try {
      const res = await fetch('/api/bot/run', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success && data.cycle.actions) {
        for (const action of data.cycle.actions) {
          if (action.type === 'OPEN') {
            addLog(`OUVERT: ${action.spread} (${action.signal}) - ${action.size} USDC`, 'success');
          } else if (action.type === 'CLOSE') {
            const pnlStr = action.pnl >= 0 ? `+${action.pnl.toFixed(2)}` : action.pnl.toFixed(2);
            addLog(`FERME: ${action.spread} - ${action.reason} (${pnlStr} USDC)`, action.pnl >= 0 ? 'success' : 'warning');
          }
        }
      }

      await fetchStatus();
      return data;
    } catch (e) {
      addLog('Erreur cycle: ' + e.message, 'error');
    }
  };

  // Demarrer/Arreter le bot
  const toggleBot = async () => {
    if (running) {
      await controlBot('stop');
      addLog('Bot arrete', 'warning');
    } else {
      await controlBot('config', { config });
      await controlBot('start');
      addLog('Bot demarre en mode ' + config.mode.toUpperCase(), 'success');
    }
  };

  // Auto-refresh et auto-run
  useEffect(() => {
    fetchStatus();
    scanOpportunities();

    const statusInterval = setInterval(fetchStatus, 10000);
    const scanInterval = setInterval(scanOpportunities, 60000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(scanInterval);
    };
  }, [fetchStatus, scanOpportunities]);

  // Auto-run quand le bot est actif
  useEffect(() => {
    if (!running) return;

    const runInterval = setInterval(runCycle, 30000);
    return () => clearInterval(runInterval);
  }, [running]);

  const stats = status?.stats || {};
  const paper = status?.paper || {};
  const positions = status?.positions?.open || [];
  const winRate = stats.totalTrades > 0
    ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Bot Trading</h1>
          <p className="text-gray-400 mt-1">Chargement...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bot Trading</h1>
          <p className="text-gray-400 mt-1">Trading automatique de spreads avec mean reversion</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Worker Status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            status?.worker?.isRunning
              ? 'bg-purple-500/10 border border-purple-500/20'
              : 'bg-gray-500/10 border border-gray-500/20'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              status?.worker?.isRunning ? 'bg-purple-500 animate-pulse' : 'bg-gray-500'
            }`} />
            <span className={status?.worker?.isRunning ? 'text-purple-400' : 'text-gray-400'}>
              Worker {status?.worker?.isRunning ? 'connecte' : 'deconnecte'}
            </span>
          </div>
          {/* Bot Status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            running ? 'bg-green-500/10 border border-green-500/20' : 'bg-gray-500/10 border border-gray-500/20'
          }`}>
            <div className={`w-2 h-2 rounded-full ${running ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className={running ? 'text-green-400' : 'text-gray-400'}>
              {running ? 'Actif' : 'Inactif'}
            </span>
          </div>
          {/* Mode */}
          <span className={`px-3 py-2 rounded-lg text-sm font-medium ${
            config.mode === 'paper'
              ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
              : 'bg-orange-500/10 border border-orange-500/20 text-orange-400'
          }`}>
            {config.mode === 'paper' ? 'PAPER' : 'LIVE'}
          </span>
        </div>
      </div>

      {/* Worker Warning */}
      {!status?.worker?.isRunning && (
        <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-purple-400">Worker non connecte</h3>
              <p className="text-sm text-purple-400/70 mt-1">
                Pour que le bot fonctionne en arriere-plan, lancez le worker dans un terminal :
              </p>
              <code className="block mt-2 px-3 py-2 bg-[#1f1f23] rounded text-sm text-gray-300 font-mono">
                npm run bot
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Balance"
          value={`${paper.balance?.toFixed(2) || '0.00'}`}
          subtitle="USDC disponible"
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Equite"
          value={`${paper.equity?.toFixed(2) || '0.00'}`}
          subtitle="Valeur totale"
          color={paper.equity >= paper.balance ? 'green' : 'red'}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <StatCard
          title="PnL Total"
          value={`${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL?.toFixed(2) || '0.00'}`}
          subtitle={`${stats.totalTrades || 0} trades executes`}
          color={stats.totalPnL >= 0 ? 'green' : 'red'}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatCard
          title="Win Rate"
          value={`${winRate}%`}
          subtitle={`${stats.winningTrades || 0}/${stats.totalTrades || 0} gagnants`}
          color="purple"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne 1: Controles + Config */}
        <div className="space-y-6">
          {/* Controles */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Controles</h2>

            <div className="flex gap-2 mb-4">
              <button
                onClick={toggleBot}
                className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                  running
                    ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                    : 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
                }`}
              >
                {running ? 'ARRETER' : 'DEMARRER'}
              </button>
              <button
                onClick={() => controlBot('reset', { initialBalance: 1000 })}
                className="px-4 py-3 bg-[#1f1f23] rounded-lg text-gray-400 hover:text-white hover:bg-[#2a2a2e] transition-colors"
                title="Reset le bot"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={runCycle}
                disabled={!running}
                className="flex-1 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Forcer un cycle
              </button>
              <button
                onClick={scanOpportunities}
                className="flex-1 py-2 bg-[#1f1f23] rounded-lg text-gray-400 text-sm hover:text-white hover:bg-[#2a2a2e] transition-colors"
              >
                Rafraichir
              </button>
            </div>
          </div>

          {/* Configuration */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">Mode</label>
                <select
                  value={config.mode}
                  onChange={e => setConfig({ ...config, mode: e.target.value })}
                  className="w-full bg-[#1f1f23] border border-[#2a2a2e] rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none"
                  disabled={running}
                >
                  <option value="paper">Paper Trading (Simulation)</option>
                  <option value="live">Live Trading (Reel)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  Taille par position: <span className="text-white font-medium">{config.maxPositionUSD} USDC</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={config.maxPositionUSD}
                  onChange={e => setConfig({ ...config, maxPositionUSD: parseInt(e.target.value) })}
                  className="w-full accent-blue-500"
                  disabled={running}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  Spreads simultanes max: <span className="text-white font-medium">{config.maxConcurrentSpreads}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={config.maxConcurrentSpreads}
                  onChange={e => setConfig({ ...config, maxConcurrentSpreads: parseInt(e.target.value) })}
                  className="w-full accent-blue-500"
                  disabled={running}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  Qualite minimum: <span className="text-white font-medium">{config.minQualityStars} etoiles</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="5"
                  value={config.minQualityStars}
                  onChange={e => setConfig({ ...config, minQualityStars: parseInt(e.target.value) })}
                  className="w-full accent-blue-500"
                  disabled={running}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  Stop Loss: <span className="text-white font-medium">{config.stopLossPercent}%</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="25"
                  value={config.stopLossPercent}
                  onChange={e => setConfig({ ...config, stopLossPercent: parseInt(e.target.value) })}
                  className="w-full accent-blue-500"
                  disabled={running}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  Z-Score entree: <span className="text-white font-medium">+/-{config.zEntryThreshold}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={config.zEntryThreshold}
                  onChange={e => setConfig({ ...config, zEntryThreshold: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500"
                  disabled={running}
                />
              </div>

              {!running && (
                <button
                  onClick={() => controlBot('config', { config })}
                  className="w-full py-2.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors"
                >
                  Sauvegarder la config
                </button>
              )}
            </div>
          </div>

          {/* Telegram */}
          <TelegramConfig addLog={addLog} />

          {/* API Keys */}
          <ApiKeysConfig
            addLog={addLog}
            mode={config.mode}
            onModeChange={(newMode) => setConfig(prev => ({ ...prev, mode: newMode }))}
          />
        </div>

        {/* Colonne 2: Positions + Opportunites */}
        <div className="space-y-6">
          {/* Positions ouvertes */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">
                Positions <span className="text-gray-500 font-normal">({positions.length}/{config.maxConcurrentSpreads})</span>
              </h2>
              {positions.length > 0 && (
                <button
                  onClick={() => controlBot('close-all')}
                  className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-colors"
                >
                  Tout fermer
                </button>
              )}
            </div>

            {positions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-[#1f1f23] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">Aucune position ouverte</p>
              </div>
            ) : (
              <div className="space-y-3">
                {positions.map(spread => (
                  <div key={spread.id} className="bg-[#151518] rounded-lg p-4 border border-[#1f1f23]">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{spread.pairId.toUpperCase()}</span>
                        <SignalBadge signal={spread.signal} size="sm" />
                      </div>
                      <button
                        onClick={() => controlBot('close-spread', { spreadId: spread.id })}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Taille:</span>
                        <span className="text-gray-300 ml-1">{spread.sizeUSD} USDC</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Entree Z:</span>
                        <span className="text-gray-300 ml-1">{spread.entryZScore?.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">PnL:</span>
                        <span className={`ml-1 font-medium ${spread.currentPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {spread.currentPnL >= 0 ? '+' : ''}{spread.currentPnL?.toFixed(2)} USDC
                        </span>
                        <span className="text-gray-600 ml-1">
                          ({((spread.currentPnL / spread.sizeUSD) * 100).toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Opportunites */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                Opportunites
              </h2>
            </div>

            {opportunities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">Aucune opportunite qualifiee</p>
                <p className="text-gray-600 text-xs mt-1">Min {config.minQualityStars} etoiles, |z| &gt; {config.zEntryThreshold}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {opportunities.slice(0, 5).map(opp => (
                  <Link
                    key={opp.pairId}
                    href={`/pairs/${opp.pairId}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#151518] hover:bg-[#1a1a1e] border border-[#1f1f23] transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{opp.pairId.toUpperCase()}</span>
                        <SignalBadge signal={opp.signal} size="sm" />
                      </div>
                      <div className="flex gap-3 text-xs text-gray-500 mt-1">
                        <span>Z: {opp.zScore?.toFixed(2)}</span>
                        <span>WR: {(opp.winRate * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <QualityStars stars={opp.qualityStars} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne 3: Logs */}
        <div className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Logs</h2>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
            >
              Effacer
            </button>
          </div>

          <div className="h-[400px] overflow-y-auto space-y-1.5 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                Les logs apparaitront ici
              </div>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg ${
                    log.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                    log.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                    log.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400' :
                    'bg-[#151518] border border-[#1f1f23] text-gray-400'
                  }`}
                >
                  <span className="text-gray-600">[{log.timestamp}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Historique des trades */}
      {status?.recentHistory?.length > 0 && (
        <div className="mt-6 card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Historique recent</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-[#1f1f23]">
                  <th className="pb-3 font-medium">Paire</th>
                  <th className="pb-3 font-medium">Signal</th>
                  <th className="pb-3 font-medium">Entree</th>
                  <th className="pb-3 font-medium">Sortie</th>
                  <th className="pb-3 font-medium">Duree</th>
                  <th className="pb-3 font-medium text-right">PnL</th>
                  <th className="pb-3 font-medium">Raison</th>
                </tr>
              </thead>
              <tbody>
                {status.recentHistory.map(trade => (
                  <tr key={trade.id} className="border-b border-[#1f1f23]/50">
                    <td className="py-3 font-medium text-white">{trade.pairId.toUpperCase()}</td>
                    <td className="py-3">
                      <SignalBadge signal={trade.signal} size="sm" />
                    </td>
                    <td className="py-3 text-gray-400">
                      {new Date(trade.entryTime).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-gray-400">
                      {new Date(trade.exitTime).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-gray-400">
                      {Math.round((trade.exitTime - trade.entryTime) / 3600000)}h
                    </td>
                    <td className={`py-3 text-right font-medium ${trade.finalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.finalPnL >= 0 ? '+' : ''}{trade.finalPnL?.toFixed(2)} USDC
                    </td>
                    <td className="py-3 text-gray-600 text-xs">{trade.exitReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warning mode live */}
      {config.mode === 'live' && (
        <div className="mt-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-orange-400">Mode LIVE active</h3>
              <p className="text-sm text-orange-400/70 mt-1">
                Le mode live necessite une connexion wallet et executera de vrais trades.
                Assurez-vous de comprendre les risques avant de demarrer.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
