// Bot Engine - Logique de trading automatique
// Utilise SQLite pour la persistence

let botDb;

// Import dynamique pour supporter à la fois le worker et Next.js
function getDb() {
  if (!botDb) {
    try {
      botDb = require('./bot-db.js');
    } catch (e) {
      // Fallback pour environnement browser/edge
      console.warn('SQLite not available, using memory fallback');
      return null;
    }
  }
  return botDb;
}

const INFO_API = 'https://api.hyperliquid.xyz/info';

/**
 * Configuration par défaut du bot
 */
export const DEFAULT_CONFIG = {
  enabled: false,
  mode: 'paper',
  maxPositionUSD: 100,
  maxConcurrentSpreads: 3,
  minQualityStars: 4,
  minWinRate: 0.6,
  zEntryThreshold: 1.5,
  zExitThreshold: 0.5,
  stopLossPercent: 10,
  activeUniverses: ['l2', 'bluechips', 'defi'],
};

/**
 * Récupère l'état actuel du bot depuis la DB
 */
export function getBotState() {
  const db = getDb();

  if (!db) {
    // Fallback mémoire si pas de DB
    return {
      config: { ...DEFAULT_CONFIG },
      isRunning: false,
      openSpreads: [],
      tradeHistory: [],
      stats: {
        totalTrades: 0,
        winningTrades: 0,
        totalPnL: 0,
        peakEquity: 1000,
        currentDrawdown: 0,
      },
      paperBalance: 1000,
      paperEquity: 1000,
    };
  }

  const config = db.getConfig();
  const stats = db.getStats();
  const openSpreads = db.getOpenSpreads();
  const tradeHistory = db.getTradeHistory(50);

  const totalUnrealizedPnL = openSpreads.reduce((sum, s) => sum + (s.currentPnL || 0), 0);
  const paperEquity = stats.paperBalance + totalUnrealizedPnL;
  const currentDrawdown = stats.peakEquity > 0
    ? ((stats.peakEquity - paperEquity) / stats.peakEquity) * 100
    : 0;

  return {
    config,
    isRunning: config.enabled,
    lastScan: null,
    lastCheck: null,
    openSpreads,
    tradeHistory,
    stats: {
      totalTrades: stats.totalTrades,
      winningTrades: stats.winningTrades,
      totalPnL: stats.totalPnL,
      peakEquity: stats.peakEquity,
      currentDrawdown: Math.max(0, currentDrawdown),
    },
    paperBalance: stats.paperBalance,
    paperEquity,
  };
}

/**
 * Met à jour la configuration du bot
 */
export function updateConfig(newConfig) {
  const db = getDb();
  if (!db) return { ...DEFAULT_CONFIG, ...newConfig };

  return db.updateConfig(newConfig);
}

/**
 * Récupère le prix mid actuel d'un asset
 */
async function getMidPrice(coin) {
  const res = await fetch(INFO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });
  const mids = await res.json();
  return parseFloat(mids[coin]);
}

/**
 * Scanner les opportunités
 */
export async function scanOpportunities() {
  const db = getDb();
  const config = db ? db.getConfig() : DEFAULT_CONFIG;

  const opportunities = [];

  for (const universe of config.activeUniverses) {
    try {
      const baseUrl = typeof window !== 'undefined' ? '' : 'http://localhost:3000';
      const res = await fetch(`${baseUrl}/api/spread/scan?universe=${universe}`);
      const data = await res.json();

      for (const pair of data.pairs || []) {
        if (pair.qualityStars < config.minQualityStars) continue;
        if (pair.winRate < config.minWinRate) continue;

        const absZ = Math.abs(pair.zScore);
        if (absZ < config.zEntryThreshold) continue;

        const signal = pair.zScore > 0 ? 'SHORT' : 'LONG';

        opportunities.push({
          ...pair,
          signal,
          universe,
          score: pair.qualityStars * 20 + absZ * 10 + pair.winRate * 15,
        });
      }
    } catch (e) {
      console.error(`Error scanning ${universe}:`, e);
    }
  }

  opportunities.sort((a, b) => b.score - a.score);
  return opportunities;
}

/**
 * Vérifie si on peut ouvrir un nouveau spread
 */
export function canOpenNewSpread() {
  const db = getDb();
  if (!db) return { allowed: false, reason: 'Database not available' };

  const config = db.getConfig();
  const openSpreads = db.getOpenSpreads();

  if (openSpreads.length >= config.maxConcurrentSpreads) {
    return { allowed: false, reason: 'Max concurrent spreads reached' };
  }

  return { allowed: true };
}

/**
 * Ouvre un spread en mode paper
 */
export async function openPaperSpread(pair, signal, sizeUSD) {
  const db = getDb();
  if (!db) throw new Error('Database not available');

  const [priceA, priceB] = await Promise.all([
    getMidPrice(pair.coinA),
    getMidPrice(pair.coinB),
  ]);

  const spread = {
    id: `${Date.now()}-${pair.pairId}`,
    pairId: pair.pairId,
    coinA: pair.coinA,
    coinB: pair.coinB,
    signal,
    sizeUSD,
    positionA: {
      side: signal === 'LONG' ? 'LONG' : 'SHORT',
      entryPrice: priceA,
      size: (sizeUSD / 2) / priceA,
    },
    positionB: {
      side: signal === 'LONG' ? 'SHORT' : 'LONG',
      entryPrice: priceB,
      size: (sizeUSD / 2) / priceB,
    },
    entryRatio: priceA / priceB,
    entryZScore: pair.zScore,
    entryTime: Date.now(),
    currentPnL: 0,
    mode: 'paper',
  };

  db.addOpenSpread(spread);

  // Frais simulés
  const stats = db.getStats();
  db.updateStats({ paperBalance: stats.paperBalance - sizeUSD * 0.001 });

  db.addLog('info', `Opened ${spread.pairId} (${signal})`, { spread });

  return spread;
}

/**
 * Met à jour les PnL des spreads ouverts
 */
export async function updateSpreadsPnL() {
  const db = getDb();
  if (!db) return [];

  const spreads = db.getOpenSpreads();
  if (spreads.length === 0) return [];

  for (const spread of spreads) {
    try {
      const [priceA, priceB] = await Promise.all([
        getMidPrice(spread.coinA),
        getMidPrice(spread.coinB),
      ]);

      const pnlA = spread.positionA.side === 'LONG'
        ? (priceA - spread.positionA.entryPrice) * spread.positionA.size
        : (spread.positionA.entryPrice - priceA) * spread.positionA.size;

      const pnlB = spread.positionB.side === 'LONG'
        ? (priceB - spread.positionB.entryPrice) * spread.positionB.size
        : (spread.positionB.entryPrice - priceB) * spread.positionB.size;

      const currentPnL = pnlA + pnlB;
      const currentRatio = priceA / priceB;

      db.updateSpreadPnL(spread.id, currentPnL, currentRatio);

    } catch (e) {
      console.error(`Error updating PnL for ${spread.pairId}:`, e);
    }
  }

  // Mettre à jour le peak equity
  const stats = db.getStats();
  const updatedSpreads = db.getOpenSpreads();
  const totalPnL = updatedSpreads.reduce((sum, s) => sum + (s.currentPnL || 0), 0);
  const equity = stats.paperBalance + totalPnL;

  if (equity > stats.peakEquity) {
    db.updateStats({ peakEquity: equity });
  }

  return updatedSpreads;
}

/**
 * Vérifie si un spread doit être fermé
 */
export async function checkExitConditions(spread) {
  const db = getDb();
  if (!db) return { shouldExit: false };

  const config = db.getConfig();
  const pnlPercent = (spread.currentPnL / spread.sizeUSD) * 100;

  // Stop loss
  if (pnlPercent < -config.stopLossPercent) {
    return { shouldExit: true, reason: 'Stop loss triggered' };
  }

  // Take profit simple (5%)
  if (pnlPercent > 5) {
    return { shouldExit: true, reason: 'Take profit (5%)' };
  }

  return { shouldExit: false };
}

/**
 * Ferme un spread en mode paper
 */
export async function closePaperSpread(spreadId, reason = 'Manual close') {
  const db = getDb();
  if (!db) throw new Error('Database not available');

  const spreads = db.getOpenSpreads();
  const spread = spreads.find(s => s.id === spreadId);
  if (!spread) return null;

  const [priceA, priceB] = await Promise.all([
    getMidPrice(spread.coinA),
    getMidPrice(spread.coinB),
  ]);

  const pnlA = spread.positionA.side === 'LONG'
    ? (priceA - spread.positionA.entryPrice) * spread.positionA.size
    : (spread.positionA.entryPrice - priceA) * spread.positionA.size;

  const pnlB = spread.positionB.side === 'LONG'
    ? (priceB - spread.positionB.entryPrice) * spread.positionB.size
    : (spread.positionB.entryPrice - priceB) * spread.positionB.size;

  const finalPnL = pnlA + pnlB - spread.sizeUSD * 0.001; // Frais de sortie

  const trade = {
    ...spread,
    positionA: { ...spread.positionA, exitPrice: priceA },
    positionB: { ...spread.positionB, exitPrice: priceB },
    exitRatio: priceA / priceB,
    exitTime: Date.now(),
    exitReason: reason,
    finalPnL,
    status: 'closed',
  };

  // Sauvegarder dans l'historique
  db.addTradeHistory(trade);

  // Supprimer des positions ouvertes
  db.removeOpenSpread(spreadId);

  // Mettre à jour les stats
  const stats = db.getStats();
  db.updateStats({
    paperBalance: stats.paperBalance + spread.sizeUSD + finalPnL,
    totalTrades: stats.totalTrades + 1,
    winningTrades: finalPnL > 0 ? stats.winningTrades + 1 : stats.winningTrades,
    totalPnL: stats.totalPnL + finalPnL,
  });

  db.addLog('info', `Closed ${spread.pairId}: ${reason} (PnL: ${finalPnL.toFixed(2)})`, { trade });

  return trade;
}

/**
 * Boucle principale du bot (une itération)
 */
export async function runBotCycle() {
  const db = getDb();
  if (!db) return { executed: false, reason: 'Database not available' };

  const config = db.getConfig();
  if (!config.enabled) {
    return { executed: false, reason: 'Bot not running' };
  }

  const actions = [];

  try {
    // 1. Mettre à jour les PnL
    await updateSpreadsPnL();

    // 2. Vérifier les sorties
    const spreads = db.getOpenSpreads();
    for (const spread of spreads) {
      const { shouldExit, reason } = await checkExitConditions(spread);
      if (shouldExit) {
        const closed = await closePaperSpread(spread.id, reason);
        if (closed) {
          actions.push({
            type: 'CLOSE',
            spread: spread.pairId,
            reason,
            pnl: closed.finalPnL,
          });
        }
      }
    }

    // 3. Vérifier si on peut ouvrir
    const { allowed } = canOpenNewSpread();
    if (allowed) {
      const opportunities = await scanOpportunities();
      const openPairIds = db.getOpenSpreads().map(s => s.pairId);
      const available = opportunities.filter(o => !openPairIds.includes(o.pairId));

      if (available.length > 0) {
        const best = available[0];
        const spread = await openPaperSpread(best, best.signal, config.maxPositionUSD);

        actions.push({
          type: 'OPEN',
          spread: spread.pairId,
          signal: best.signal,
          size: config.maxPositionUSD,
        });
      }
    }

    return {
      executed: true,
      actions,
      state: getBotState(),
    };

  } catch (error) {
    console.error('Bot cycle error:', error);
    if (db) db.addLog('error', `Cycle error: ${error.message}`);
    return { executed: false, error: error.message };
  }
}

/**
 * Démarre le bot
 */
export function startBot() {
  const db = getDb();
  if (db) {
    db.setEnabled(true);
    db.addLog('info', 'Bot started');
  }
  return { success: true, message: 'Bot started' };
}

/**
 * Arrête le bot
 */
export function stopBot() {
  const db = getDb();
  if (db) {
    db.setEnabled(false);
    db.addLog('info', 'Bot stopped');
  }
  return { success: true, message: 'Bot stopped' };
}

/**
 * Reset le bot
 */
export function resetBot(initialBalance = 1000) {
  const db = getDb();
  if (db) {
    db.resetStats(initialBalance);
    db.addLog('info', `Bot reset with balance ${initialBalance}`);
  }
  return { success: true, message: 'Bot reset', balance: initialBalance };
}

export default {
  getBotState,
  updateConfig,
  scanOpportunities,
  canOpenNewSpread,
  openPaperSpread,
  updateSpreadsPnL,
  checkExitConditions,
  closePaperSpread,
  runBotCycle,
  startBot,
  stopBot,
  resetBot,
  DEFAULT_CONFIG,
};
