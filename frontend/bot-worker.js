#!/usr/bin/env node
/**
 * Bot Worker Autonome - Spread Trading
 *
 * Ce script tourne en arrière-plan et exécute le bot de trading
 * indépendamment du navigateur.
 *
 * Usage:
 *   node bot-worker.js          # Démarre le worker
 *   node bot-worker.js --status # Affiche le statut
 *   node bot-worker.js --stop   # Arrête le bot
 *   node bot-worker.js --reset  # Reset le bot
 *
 * Pour un fonctionnement 24/7, utilisez PM2:
 *   pm2 start bot-worker.js --name "trade-bot"
 *   pm2 logs trade-bot
 *   pm2 stop trade-bot
 */

const path = require('path');
const fs = require('fs');

// Configuration des chemins
process.chdir(__dirname);
const srcPath = path.join(__dirname, 'src');

// Import du module de base de données
const botDb = require('./src/lib/bot-db.js');

// Import du module Telegram
const telegram = require('./src/lib/telegram.js');

// Import du client API Hyperliquid
const hlApi = require('./src/lib/hyperliquid-api.js');

// Client Hyperliquid pour le live trading
let hlClient = null;

// ============ CONFIGURATION ============

const SCAN_INTERVAL_MS = 60000;      // Scanner toutes les 60s
const CHECK_INTERVAL_MS = 30000;     // Vérifier positions toutes les 30s
const CLEANUP_INTERVAL_MS = 3600000; // Nettoyer logs toutes les heures
const DAILY_REPORT_HOUR = 20;        // Envoyer rapport journalier à 20h

const API_BASE = 'https://api.hyperliquid.xyz/info';

// ============ UTILITAIRES API ============

async function fetchCandles(coin, interval, startTime, endTime) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: { coin, interval, startTime, endTime },
    }),
  });

  if (!res.ok) throw new Error(`candleSnapshot error for ${coin}: ${res.status}`);
  return res.json();
}

async function getMidPrice(coin) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });
  const mids = await res.json();
  return parseFloat(mids[coin]);
}

async function getAllMidPrices() {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });
  return res.json();
}

// ============ LOGIQUE DE SCAN ============

const UNIVERSES = {
  l2: ['OP', 'ARB', 'MNT', 'STRK', 'ZK', 'MATIC', 'IMX', 'METIS', 'MANTA', 'BLAST'],
  dex: ['UNI', 'SUSHI', 'GMX', 'APEX', 'DYDX', 'CRV', 'BAL', 'VELO', 'JUP', 'RAY'],
  bluechips: ['BTC', 'ETH', 'SOL', 'AVAX', 'BNB', 'LINK', 'DOT', 'ATOM'],
  defi: ['AAVE', 'COMP', 'MKR', 'SNX', 'LDO', 'RPL', 'FXS', 'PENDLE'],
  ai: ['FET', 'RNDR', 'AGIX', 'TAO', 'AR', 'FIL', 'GRT', 'OCEAN'],
};

function generatePairs(coins) {
  const pairs = [];
  for (let i = 0; i < coins.length; i++) {
    for (let j = i + 1; j < coins.length; j++) {
      pairs.push({ a: coins[i], b: coins[j] });
    }
  }
  return pairs;
}

function computeStatsRatio(seriesA, seriesB, lookbackDays = 90) {
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < 20) return null;

  const ratios = [];
  const retsA = [];
  const retsB = [];

  for (let i = 1; i < n; i++) {
    const a0 = seriesA[i - 1].c;
    const a1 = seriesA[i].c;
    const b0 = seriesB[i - 1].c;
    const b1 = seriesB[i].c;
    if (!a1 || !b1) continue;

    ratios.push({ ratio: a1 / b1, t: seriesA[i].t });
    retsA.push(Math.log(a1 / a0));
    retsB.push(Math.log(b1 / b0));
  }

  if (ratios.length < 20) return null;

  const lookbackPoints = Math.min(lookbackDays, ratios.length);
  const recentRatios = ratios.slice(-lookbackPoints).map(r => r.ratio);
  const mean = recentRatios.reduce((s, v) => s + v, 0) / recentRatios.length;
  const variance = recentRatios.reduce((s, v) => s + (v - mean) ** 2, 0) / (recentRatios.length - 1);
  const std = Math.sqrt(variance);

  // Corrélation
  const mA = retsA.reduce((s, v) => s + v, 0) / retsA.length;
  const mB = retsB.reduce((s, v) => s + v, 0) / retsB.length;
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < retsA.length; i++) {
    const da = retsA[i] - mA;
    const db = retsB[i] - mB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  cov /= retsA.length;
  varA /= retsA.length;
  varB /= retsA.length;
  const corr = cov / (Math.sqrt(varA) * Math.sqrt(varB) || 1);

  // Backtest simplifié
  const zEnter = 1.5;
  const zExit = 0.5;
  const trades = [];
  let currentTrade = null;
  let maxDrawdown = 0;
  let peak = ratios[0].ratio;

  for (let i = lookbackPoints; i < ratios.length; i++) {
    const r = ratios[i].ratio;
    if (r > peak) peak = r;
    const dd = (peak - r) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;

    const windowRatios = ratios.slice(i - lookbackPoints, i).map(x => x.ratio);
    const windowMean = windowRatios.reduce((s, v) => s + v, 0) / windowRatios.length;
    const windowVar = windowRatios.reduce((s, v) => s + (v - windowMean) ** 2, 0) / (windowRatios.length - 1);
    const windowStd = Math.sqrt(windowVar);
    const z = windowStd > 0 ? (r - windowMean) / windowStd : 0;

    if (!currentTrade) {
      if (z > zEnter) currentTrade = { side: 'short', entryRatio: r, entryZ: z };
      else if (z < -zEnter) currentTrade = { side: 'long', entryRatio: r, entryZ: z };
    } else if (Math.abs(z) < zExit) {
      const pct = currentTrade.side === 'short'
        ? (currentTrade.entryRatio - r) / currentTrade.entryRatio
        : (r - currentTrade.entryRatio) / currentTrade.entryRatio;
      trades.push({ pct });
      currentTrade = null;
    }
  }

  const nbTrades = trades.length;
  const wins = trades.filter(t => t.pct > 0).length;
  const winRate = nbTrades > 0 ? wins / nbTrades : 0;
  const avgReturn = nbTrades > 0 ? trades.reduce((s, t) => s + t.pct, 0) / nbTrades : 0;

  const lastRatio = ratios[ratios.length - 1].ratio;
  const zScore = std > 0 ? (lastRatio - mean) / std : 0;

  // Score de qualité
  let qualityStars = 0;
  let maxStars = 5;

  if (avgReturn < 0) maxStars = 1;
  else if (maxDrawdown > 0.5) maxStars = 1;
  else if (maxDrawdown > 0.4) maxStars = 2;
  else if (winRate < 0.5) maxStars = 2;
  else if (nbTrades < 3) maxStars = 2;

  if (avgReturn >= 0.08) qualityStars += 2;
  else if (avgReturn >= 0.05) qualityStars += 1.5;
  else if (avgReturn >= 0.02) qualityStars += 1;
  else if (avgReturn > 0) qualityStars += 0.5;

  if (winRate >= 0.8) qualityStars += 1.5;
  else if (winRate >= 0.7) qualityStars += 1;
  else if (winRate >= 0.6) qualityStars += 0.5;

  if (maxDrawdown <= 0.2) qualityStars += 1;
  else if (maxDrawdown <= 0.3) qualityStars += 0.5;

  const absZ = Math.abs(zScore);
  if (absZ >= 1.5 && absZ <= 2.5) qualityStars += 0.5;

  qualityStars = Math.min(maxStars, Math.round(qualityStars));

  return {
    mean, std, corr, lastRatio, zScore,
    maxDrawdown: maxDrawdown * 100,
    nbTrades, winRate, avgReturn: avgReturn * 100,
    qualityStars,
  };
}

async function scanOpportunities(config) {
  const opportunities = [];
  const uniqueCoins = new Set();

  for (const universe of config.activeUniverses) {
    const coins = UNIVERSES[universe] || [];
    coins.forEach(c => uniqueCoins.add(c));
  }

  const coinsArray = [...uniqueCoins];
  const now = Date.now();
  const startTime = now - 365 * 24 * 60 * 60 * 1000;

  // Récupérer les candles
  const candlesMap = {};
  await Promise.all(
    coinsArray.map(async (coin) => {
      try {
        const candles = await fetchCandles(coin, '1d', startTime, now);
        candlesMap[coin] = candles.map(c => ({ t: c.t, c: parseFloat(c.c) }));
      } catch (e) {
        candlesMap[coin] = null;
      }
    })
  );

  // Générer et analyser les paires
  const pairs = generatePairs(coinsArray);

  for (const pair of pairs) {
    const seriesA = candlesMap[pair.a];
    const seriesB = candlesMap[pair.b];
    if (!seriesA || !seriesB) continue;

    const stats = computeStatsRatio(seriesA, seriesB);
    if (!stats) continue;

    // Filtrer selon config
    if (stats.qualityStars < config.minQualityStars) continue;
    if (stats.winRate < config.minWinRate) continue;

    const absZ = Math.abs(stats.zScore);
    if (absZ < config.zEntryThreshold) continue;

    const signal = stats.zScore > 0 ? 'SHORT' : 'LONG';

    opportunities.push({
      pairId: `${pair.a}-${pair.b}`.toLowerCase(),
      coinA: pair.a,
      coinB: pair.b,
      signal,
      zScore: stats.zScore,
      qualityStars: stats.qualityStars,
      winRate: stats.winRate,
      avgReturn: stats.avgReturn,
      score: stats.qualityStars * 20 + absZ * 10 + stats.winRate * 15,
    });
  }

  opportunities.sort((a, b) => b.score - a.score);
  return opportunities;
}

// ============ LOGIQUE DE TRADING ============

/**
 * Initialise le client Hyperliquid pour le live trading
 */
function initHyperliquidClient(config) {
  if (config.mode !== 'live') {
    hlClient = null;
    return false;
  }

  if (!config.apiKey || !config.apiSecret || !config.walletAddress) {
    log('error', 'Live mode requires API keys configuration');
    return false;
  }

  hlClient = hlApi.createClient({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    walletAddress: config.walletAddress,
  });

  return true;
}

/**
 * Ouvre une position spread en LIVE (vraie exécution sur Hyperliquid)
 */
async function openLiveSpread(pair, signal, sizeUSD, config) {
  if (!hlClient) {
    throw new Error('Hyperliquid client not initialized');
  }

  log('info', `[LIVE] Opening ${pair.pairId} (${signal}) - ${sizeUSD} USDC`);

  try {
    // Exécuter les ordres sur Hyperliquid
    const results = await hlClient.placeSpreadTrade({
      coinA: pair.coinA,
      coinB: pair.coinB,
      sizeUSD,
      signal,
    });

    // Vérifier les résultats
    const errors = results.filter(r => r.status === 'err');
    if (errors.length > 0) {
      throw new Error(`Order errors: ${errors.map(e => e.response).join(', ')}`);
    }

    // Récupérer les prix d'exécution
    const [priceA, priceB] = await Promise.all([
      getMidPrice(pair.coinA),
      getMidPrice(pair.coinB),
    ]);

    const spread = {
      id: `live-${Date.now()}-${pair.pairId}`,
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
      mode: 'live',
    };

    // Sauvegarder en DB
    botDb.addOpenSpread(spread);
    botDb.addLog('info', `[LIVE] Opened ${spread.pairId}`, { spread, results });

    // Notification Telegram
    if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
      telegram.notifyTradeOpened(config.telegramBotToken, config.telegramChatId, spread);
    }

    return spread;

  } catch (error) {
    log('error', `[LIVE] Failed to open ${pair.pairId}: ${error.message}`);
    botDb.addLog('error', `[LIVE] Open failed: ${error.message}`, { pair, error: error.message });

    // Notification erreur
    if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
      telegram.notifyError(config.telegramBotToken, config.telegramChatId,
        `Échec ouverture ${pair.pairId}: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Ferme une position spread en LIVE
 */
async function closeLiveSpread(spreadId, reason, config) {
  if (!hlClient) {
    throw new Error('Hyperliquid client not initialized');
  }

  const spread = botDb.getOpenSpreads().find(s => s.id === spreadId);
  if (!spread) return null;

  log('info', `[LIVE] Closing ${spread.pairId} - ${reason}`);

  try {
    // Fermer les positions sur Hyperliquid
    const results = await hlClient.closeSpreadTrade({
      coinA: spread.coinA,
      coinB: spread.coinB,
      positionA: spread.positionA,
      positionB: spread.positionB,
    });

    // Récupérer les prix de sortie
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

    // Estimer les frais (0.05% par trade * 2 côtés * 2 opérations)
    const fees = spread.sizeUSD * 0.002;
    const finalPnL = pnlA + pnlB - fees;

    // Créer l'entrée historique
    const trade = {
      ...spread,
      positionA: { ...spread.positionA, exitPrice: priceA },
      positionB: { ...spread.positionB, exitPrice: priceB },
      exitRatio: priceA / priceB,
      exitTime: Date.now(),
      exitReason: reason,
      finalPnL,
    };

    botDb.addTradeHistory(trade);
    botDb.removeOpenSpread(spreadId);

    // Mettre à jour les stats
    const stats = botDb.getStats();
    botDb.updateStats({
      totalTrades: stats.totalTrades + 1,
      winningTrades: finalPnL > 0 ? stats.winningTrades + 1 : stats.winningTrades,
      totalPnL: stats.totalPnL + finalPnL,
    });

    botDb.addLog('info', `[LIVE] Closed ${spread.pairId}: ${finalPnL.toFixed(2)} USDC`, { trade, results });

    // Notification Telegram
    if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
      telegram.notifyTradeClosed(config.telegramBotToken, config.telegramChatId, trade);
    }

    return trade;

  } catch (error) {
    log('error', `[LIVE] Failed to close ${spread.pairId}: ${error.message}`);
    botDb.addLog('error', `[LIVE] Close failed: ${error.message}`, { spread, error: error.message });

    // Notification erreur
    if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
      telegram.notifyError(config.telegramBotToken, config.telegramChatId,
        `⚠️ ÉCHEC FERMETURE ${spread.pairId}: ${error.message}\nVérifiez vos positions manuellement!`);
    }

    throw error;
  }
}

async function openPaperSpread(pair, signal, sizeUSD) {
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

  // Sauvegarder en DB
  botDb.addOpenSpread(spread);

  // Mettre à jour le solde (frais simulés)
  const stats = botDb.getStats();
  botDb.updateStats({ paperBalance: stats.paperBalance - sizeUSD * 0.001 });

  // Notification Telegram
  const config = botDb.getConfig();
  if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
    telegram.notifyTradeOpened(config.telegramBotToken, config.telegramChatId, spread);
  }

  return spread;
}

async function updateSpreadsPnL() {
  const spreads = botDb.getOpenSpreads();
  if (spreads.length === 0) return;

  const mids = await getAllMidPrices();

  for (const spread of spreads) {
    const priceA = parseFloat(mids[spread.coinA]);
    const priceB = parseFloat(mids[spread.coinB]);

    if (!priceA || !priceB) continue;

    const pnlA = spread.positionA.side === 'LONG'
      ? (priceA - spread.positionA.entryPrice) * spread.positionA.size
      : (spread.positionA.entryPrice - priceA) * spread.positionA.size;

    const pnlB = spread.positionB.side === 'LONG'
      ? (priceB - spread.positionB.entryPrice) * spread.positionB.size
      : (spread.positionB.entryPrice - priceB) * spread.positionB.size;

    const currentPnL = pnlA + pnlB;
    const currentRatio = priceA / priceB;

    botDb.updateSpreadPnL(spread.id, currentPnL, currentRatio);
  }

  // Mettre à jour l'équité
  const updatedSpreads = botDb.getOpenSpreads();
  const totalPnL = updatedSpreads.reduce((sum, s) => sum + (s.currentPnL || 0), 0);
  const stats = botDb.getStats();
  const equity = stats.paperBalance + totalPnL;

  if (equity > stats.peakEquity) {
    botDb.updateStats({ peakEquity: equity });
  }
}

async function checkExitConditions(spread, config) {
  const pnlPercent = (spread.currentPnL / spread.sizeUSD) * 100;

  // Stop loss
  if (pnlPercent < -config.stopLossPercent) {
    return { shouldExit: true, reason: 'Stop loss triggered' };
  }

  // Vérifier z-score (requiert nouveau scan - simplifié ici)
  if (Math.abs(spread.currentPnL / spread.sizeUSD) > 0.05 && spread.currentPnL > 0) {
    // Take profit si gain > 5%
    return { shouldExit: true, reason: 'Take profit (5%)' };
  }

  return { shouldExit: false };
}

async function closePaperSpread(spreadId, reason) {
  const spread = botDb.getOpenSpreads().find(s => s.id === spreadId);
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

  // Créer l'entrée historique
  const trade = {
    ...spread,
    positionA: { ...spread.positionA, exitPrice: priceA },
    positionB: { ...spread.positionB, exitPrice: priceB },
    exitRatio: priceA / priceB,
    exitTime: Date.now(),
    exitReason: reason,
    finalPnL,
  };

  botDb.addTradeHistory(trade);
  botDb.removeOpenSpread(spreadId);

  // Mettre à jour les stats
  const stats = botDb.getStats();
  botDb.updateStats({
    paperBalance: stats.paperBalance + spread.sizeUSD + finalPnL,
    totalTrades: stats.totalTrades + 1,
    winningTrades: finalPnL > 0 ? stats.winningTrades + 1 : stats.winningTrades,
    totalPnL: stats.totalPnL + finalPnL,
  });

  // Notification Telegram
  const config = botDb.getConfig();
  if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
    telegram.notifyTradeClosed(config.telegramBotToken, config.telegramChatId, trade);
  }

  return trade;
}

// ============ CYCLE PRINCIPAL ============

async function runBotCycle() {
  const config = botDb.getConfig();

  if (!config.enabled) {
    return { executed: false, reason: 'Bot disabled' };
  }

  const isLive = config.mode === 'live';
  const modeTag = isLive ? '[LIVE]' : '[PAPER]';

  // Initialiser le client Hyperliquid si nécessaire
  if (isLive && !hlClient) {
    const initialized = initHyperliquidClient(config);
    if (!initialized) {
      botDb.addLog('error', 'Cannot start live trading: API keys not configured');
      return { executed: false, reason: 'Live mode requires API keys' };
    }
    log('success', 'Hyperliquid client initialized for LIVE trading');
  }

  const actions = [];

  try {
    // 1. Mettre à jour les PnL
    await updateSpreadsPnL();

    // 2. Vérifier les sorties
    const spreads = botDb.getOpenSpreads();
    for (const spread of spreads) {
      const { shouldExit, reason } = await checkExitConditions(spread, config);
      if (shouldExit) {
        let closed;

        // Utiliser la bonne méthode selon le mode de la position
        if (spread.mode === 'live') {
          closed = await closeLiveSpread(spread.id, reason, config);
        } else {
          closed = await closePaperSpread(spread.id, reason);
        }

        if (closed) {
          actions.push({
            type: 'CLOSE',
            mode: spread.mode,
            spread: spread.pairId,
            reason,
            pnl: closed.finalPnL,
          });
          botDb.addLog('info', `${modeTag} Fermé ${spread.pairId}: ${reason} (PnL: ${closed.finalPnL.toFixed(2)})`, closed);
        }
      }
    }

    // 3. Vérifier si on peut ouvrir
    const currentSpreads = botDb.getOpenSpreads();
    if (currentSpreads.length >= config.maxConcurrentSpreads) {
      return { executed: true, actions, reason: 'Max spreads reached' };
    }

    // 4. Scanner les opportunités
    const opportunities = await scanOpportunities(config);
    const openPairIds = currentSpreads.map(s => s.pairId);
    const available = opportunities.filter(o => !openPairIds.includes(o.pairId));

    if (available.length > 0) {
      const best = available[0];
      let spread;

      // Ouvrir en mode live ou paper
      if (isLive) {
        spread = await openLiveSpread(best, best.signal, config.maxPositionUSD, config);
      } else {
        spread = await openPaperSpread(best, best.signal, config.maxPositionUSD);
      }

      actions.push({
        type: 'OPEN',
        mode: config.mode,
        spread: spread.pairId,
        signal: best.signal,
        size: config.maxPositionUSD,
      });

      botDb.addLog('info', `${modeTag} Ouvert ${spread.pairId} (${best.signal}) - ${config.maxPositionUSD} USDC`, spread);
    }

    return { executed: true, actions, mode: config.mode };

  } catch (error) {
    botDb.addLog('error', `${modeTag} Erreur cycle: ${error.message}`, { stack: error.stack });

    // Notification d'erreur en live
    if (isLive && config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
      telegram.notifyError(config.telegramBotToken, config.telegramChatId,
        `Erreur cycle: ${error.message}`);
    }

    return { executed: false, error: error.message };
  }
}

// ============ WORKER ============

let isRunning = false;
let cycleInterval = null;
let checkInterval = null;
let cleanupInterval = null;
let dailyReportInterval = null;
let lastDailyReportDate = null;

function log(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m',
    success: '\x1b[32m[OK]\x1b[0m',
  }[level] || '[LOG]';

  console.log(`${timestamp} ${prefix} ${message}`);
}

async function startWorker() {
  if (isRunning) {
    log('warn', 'Worker already running');
    return;
  }

  const config = botDb.getConfig();

  log('info', '=== Bot Worker Starting ===');
  log('info', `Mode: ${config.mode.toUpperCase()}`);
  log('info', `Scan interval: ${SCAN_INTERVAL_MS / 1000}s`);
  log('info', `Check interval: ${CHECK_INTERVAL_MS / 1000}s`);

  // Initialiser le client Hyperliquid si en mode live
  if (config.mode === 'live') {
    const initialized = initHyperliquidClient(config);
    if (!initialized) {
      log('error', 'Cannot start in LIVE mode: API keys not configured');
      log('info', 'Falling back to PAPER mode');
      botDb.updateConfig({ mode: 'paper' });
    } else {
      log('success', 'Hyperliquid client initialized');

      // Afficher la balance live
      try {
        const balance = await hlClient.getBalance();
        log('info', `Live balance: ${balance.equity.toFixed(2)} USDC (available: ${balance.available.toFixed(2)})`);
      } catch (e) {
        log('warn', `Could not fetch live balance: ${e.message}`);
      }
    }
  }

  isRunning = true;

  // Activer le bot et marquer le worker comme démarré
  botDb.setEnabled(true);
  botDb.setWorkerStarted();
  botDb.addLog('info', `Worker started in ${config.mode.toUpperCase()} mode`);

  // Notification Telegram
  if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
    telegram.notifyBotStarted(config.telegramBotToken, config.telegramChatId, config);
  }

  // Cycle principal
  const runCycle = async () => {
    const config = botDb.getConfig();
    if (!config.enabled) {
      log('warn', 'Bot disabled, skipping cycle');
      return;
    }

    log('info', 'Running cycle...');
    const result = await runBotCycle();

    if (result.executed) {
      // Mettre à jour le heartbeat
      botDb.updateWorkerHeartbeat(true);

      if (result.actions && result.actions.length > 0) {
        for (const action of result.actions) {
          if (action.type === 'OPEN') {
            log('success', `OPENED: ${action.spread} (${action.signal}) - ${action.size} USDC`);
          } else if (action.type === 'CLOSE') {
            const pnlStr = action.pnl >= 0 ? `+${action.pnl.toFixed(2)}` : action.pnl.toFixed(2);
            log(action.pnl >= 0 ? 'success' : 'warn', `CLOSED: ${action.spread} - ${action.reason} (${pnlStr} USDC)`);
          }
        }
      } else {
        log('info', 'Cycle completed, no actions');
      }
    } else {
      // Heartbeat même si le cycle est skipped
      botDb.updateWorkerHeartbeat(false);
      log('warn', `Cycle skipped: ${result.reason || result.error}`);
    }
  };

  // Check positions
  const checkPositions = async () => {
    try {
      await updateSpreadsPnL();
      const spreads = botDb.getOpenSpreads();
      const stats = botDb.getStats();
      const totalPnL = spreads.reduce((sum, s) => sum + (s.currentPnL || 0), 0);
      const equity = stats.paperBalance + totalPnL;

      log('info', `Positions: ${spreads.length} | Balance: ${stats.paperBalance.toFixed(2)} | Equity: ${equity.toFixed(2)} | PnL: ${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}`);
    } catch (e) {
      log('error', `Check positions error: ${e.message}`);
    }
  };

  // Exécuter immédiatement
  await runCycle();

  // Rapport journalier automatique
  const checkDailyReport = async () => {
    const now = new Date();
    const today = now.toDateString();
    const hour = now.getHours();

    // Envoyer le rapport à l'heure configurée, une seule fois par jour
    if (hour === DAILY_REPORT_HOUR && lastDailyReportDate !== today) {
      const config = botDb.getConfig();
      if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
        try {
          const stats = botDb.getStats();
          const history = botDb.getTradeHistory(100);

          // Filtrer les trades d'aujourd'hui
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayTrades = history.filter(t => t.exitTime >= todayStart.getTime());

          await telegram.notifyDailyReport(
            config.telegramBotToken,
            config.telegramChatId,
            stats,
            todayTrades
          );

          lastDailyReportDate = today;
          log('info', 'Rapport journalier envoyé sur Telegram');
          botDb.addLog('info', 'Rapport journalier envoyé');
        } catch (e) {
          log('error', `Erreur rapport journalier: ${e.message}`);
        }
      }
    }
  };

  // Démarrer les intervalles
  cycleInterval = setInterval(runCycle, SCAN_INTERVAL_MS);
  checkInterval = setInterval(checkPositions, CHECK_INTERVAL_MS);
  cleanupInterval = setInterval(() => botDb.cleanOldLogs(), CLEANUP_INTERVAL_MS);
  dailyReportInterval = setInterval(checkDailyReport, 60000); // Vérifier toutes les minutes

  log('success', 'Worker started successfully');
  log('info', `Rapport journalier programmé à ${DAILY_REPORT_HOUR}h00`);
}

function stopWorker() {
  if (!isRunning) {
    log('warn', 'Worker not running');
    return;
  }

  log('info', 'Stopping worker...');

  clearInterval(cycleInterval);
  clearInterval(checkInterval);
  clearInterval(cleanupInterval);
  clearInterval(dailyReportInterval);

  // Notification Telegram avant d'arrêter
  const config = botDb.getConfig();
  const stats = botDb.getStats();
  if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
    telegram.notifyBotStopped(config.telegramBotToken, config.telegramChatId, stats);
  }

  botDb.setEnabled(false);
  botDb.setWorkerStopped();
  botDb.addLog('info', 'Worker stopped');

  isRunning = false;
  log('success', 'Worker stopped');
}

async function showStatus() {
  const config = botDb.getConfig();
  const stats = botDb.getStats();
  const spreads = botDb.getOpenSpreads();
  const history = botDb.getTradeHistory(10);

  const totalPnL = spreads.reduce((sum, s) => sum + (s.currentPnL || 0), 0);
  const equity = stats.paperBalance + totalPnL;
  const winRate = stats.totalTrades > 0
    ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(1)
    : '0.0';

  console.log('\n=== BOT STATUS ===\n');
  console.log(`Enabled:    ${config.enabled ? '\x1b[32mYES\x1b[0m' : '\x1b[31mNO\x1b[0m'}`);
  console.log(`Mode:       ${config.mode.toUpperCase()}`);

  // Afficher la balance appropriée selon le mode
  if (config.mode === 'live' && config.apiKey && config.apiSecret && config.walletAddress) {
    console.log(`API Key:    ${config.apiKey.slice(0, 8)}... ✓`);
    console.log(`Wallet:     ${config.walletAddress.slice(0, 10)}...`);

    // Essayer de récupérer la balance live
    try {
      const client = hlApi.createClient({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        walletAddress: config.walletAddress,
      });
      const balance = await client.getBalance();
      console.log(`\x1b[33mLive Balance: ${balance.equity.toFixed(2)} USDC\x1b[0m`);
      console.log(`Available:  ${balance.available.toFixed(2)} USDC`);
    } catch (e) {
      console.log(`Live Balance: \x1b[31mCannot fetch\x1b[0m`);
    }
  } else {
    console.log(`Balance:    ${stats.paperBalance.toFixed(2)} USDC (paper)`);
    console.log(`Equity:     ${equity.toFixed(2)} USDC`);
  }

  console.log(`Total PnL:  ${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)} USDC`);
  console.log(`Win Rate:   ${winRate}% (${stats.winningTrades}/${stats.totalTrades})`);
  console.log(`Positions:  ${spreads.length}/${config.maxConcurrentSpreads}`);

  if (spreads.length > 0) {
    console.log('\n--- Open Positions ---');
    for (const s of spreads) {
      const pnlStr = s.currentPnL >= 0 ? `+${s.currentPnL.toFixed(2)}` : s.currentPnL.toFixed(2);
      console.log(`  ${s.pairId.toUpperCase()} (${s.signal}) - ${s.sizeUSD} USDC - PnL: ${pnlStr}`);
    }
  }

  if (history.length > 0) {
    console.log('\n--- Recent Trades ---');
    for (const t of history.slice(0, 5)) {
      const pnlStr = t.finalPnL >= 0 ? `+${t.finalPnL.toFixed(2)}` : t.finalPnL.toFixed(2);
      const date = new Date(t.exitTime).toLocaleDateString();
      console.log(`  ${date} | ${t.pairId.toUpperCase()} (${t.signal}) - ${pnlStr} USDC - ${t.exitReason}`);
    }
  }

  console.log('\n--- Configuration ---');
  console.log(`  Position size:  ${config.maxPositionUSD} USDC`);
  console.log(`  Max spreads:    ${config.maxConcurrentSpreads}`);
  console.log(`  Min quality:    ${config.minQualityStars} stars`);
  console.log(`  Z-entry:        ±${config.zEntryThreshold}`);
  console.log(`  Stop loss:      ${config.stopLossPercent}%`);
  console.log(`  Universes:      ${config.activeUniverses.join(', ')}`);
  console.log('');
}

// ============ CLI ============

const args = process.argv.slice(2);

if (args.includes('--status')) {
  showStatus().then(() => process.exit(0));
}

if (args.includes('--stop')) {
  botDb.setEnabled(false);
  botDb.addLog('info', 'Bot stopped via CLI');
  console.log('Bot stopped');
  process.exit(0);
}

if (args.includes('--reset')) {
  botDb.resetStats(1000);
  botDb.addLog('info', 'Bot reset via CLI');
  console.log('Bot reset (balance: 1000 USDC)');
  process.exit(0);
}

// Démarrer le worker
startWorker();

// Gérer l'arrêt propre
process.on('SIGINT', () => {
  log('info', 'Received SIGINT');
  stopWorker();
  botDb.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM');
  stopWorker();
  botDb.close();
  process.exit(0);
});
