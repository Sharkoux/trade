/**
 * Module de trading - Gestion des positions
 */

const { TRADING_LIMITS } = require('./config');
const { getMidPrice, getAllMidPrices, fetchCandles } = require('./api');
const { computeStatsRatio } = require('./scanner');

/**
 * Ouvre une position en mode paper
 */
async function openPaperSpread(botDb, pair, signal, sizeUSD, telegram = null) {
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
    zExitThreshold: pair.zExitThreshold || 0.5,
    isOptimized: pair.isOptimized || false,
    entryTime: Date.now(),
    currentPnL: 0,
    mode: 'paper',
  };

  // Sauvegarder en DB
  botDb.addOpenSpread(spread);

  // Mettre à jour le solde (frais simulés 0.1%)
  const stats = botDb.getStats();
  botDb.updateStats({ paperBalance: stats.paperBalance - sizeUSD * 0.001 });

  // Notification Telegram
  const config = botDb.getConfig();
  if (telegram && config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
    telegram.notifyTradeOpened(config.telegramBotToken, config.telegramChatId, spread);
  }

  return spread;
}

/**
 * Ferme une position en mode paper
 */
async function closePaperSpread(botDb, spreadId, reason, telegram = null) {
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
  if (telegram && config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
    telegram.notifyTradeClosed(config.telegramBotToken, config.telegramChatId, trade);
  }

  return trade;
}

/**
 * Met à jour les PnL de toutes les positions ouvertes
 */
async function updateSpreadsPnL(botDb) {
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

/**
 * Vérifie les conditions de sortie pour un spread
 */
async function checkExitConditions(spread, config, log = () => {}) {
  const pnlPercent = (spread.currentPnL / spread.sizeUSD) * 100;

  // Stop loss
  if (pnlPercent < -config.stopLossPercent) {
    return { shouldExit: true, reason: 'Stop loss triggered' };
  }

  // Vérifier le z-score actuel (mean reversion)
  try {
    const now = Date.now();
    const startTime = now - TRADING_LIMITS.LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

    const [candlesA, candlesB] = await Promise.all([
      fetchCandles(spread.coinA, '1d', startTime, now),
      fetchCandles(spread.coinB, '1d', startTime, now),
    ]);

    if (candlesA.length > TRADING_LIMITS.MIN_DATA_POINTS && candlesB.length > TRADING_LIMITS.MIN_DATA_POINTS) {
      const seriesA = candlesA.map(c => ({ t: c.t, c: parseFloat(c.c) }));
      const seriesB = candlesB.map(c => ({ t: c.t, c: parseFloat(c.c) }));

      const stats = computeStatsRatio(seriesA, seriesB);

      if (stats) {
        const currentZ = Math.abs(stats.zScore);
        const zExitThreshold = spread.zExitThreshold || config.zExitThreshold || 0.5;

        // Sortir si le z-score est revenu vers la moyenne
        if (currentZ < zExitThreshold && spread.currentPnL > 0) {
          const optimizedTag = spread.isOptimized ? ' [OPT]' : '';
          return {
            shouldExit: true,
            reason: `Mean reversion (z=${currentZ.toFixed(2)} < ${zExitThreshold})${optimizedTag}`,
          };
        }
      }
    }
  } catch (e) {
    log('warn', `Exit check error for ${spread.pairId}: ${e.message}`);
  }

  // Take profit
  if (pnlPercent > TRADING_LIMITS.TAKE_PROFIT_PERCENT) {
    return { shouldExit: true, reason: `Take profit (${TRADING_LIMITS.TAKE_PROFIT_PERCENT}%)` };
  }

  // Max holding time
  const holdingTime = Date.now() - spread.entryTime;
  if (holdingTime > TRADING_LIMITS.MAX_HOLDING_TIME_MS) {
    return { shouldExit: true, reason: 'Max holding time (7d)' };
  }

  return { shouldExit: false };
}

/**
 * Ouvre une position en mode live (vraie exécution)
 */
async function openLiveSpread(botDb, hlClient, pair, signal, sizeUSD, config, telegram = null, log = () => {}) {
  if (!hlClient) {
    throw new Error('Hyperliquid client not initialized');
  }

  log('info', `[LIVE] Opening ${pair.pairId} (${signal}) - ${sizeUSD} USDC`);

  try {
    const results = await hlClient.placeSpreadTrade({
      coinA: pair.coinA,
      coinB: pair.coinB,
      sizeUSD,
      signal,
    });

    const errors = results.filter(r => r.status === 'err');
    if (errors.length > 0) {
      throw new Error(`Order errors: ${errors.map(e => e.response).join(', ')}`);
    }

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

    botDb.addOpenSpread(spread);
    botDb.addLog('info', `[LIVE] Opened ${spread.pairId}`, { spread, results });

    if (telegram && config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
      telegram.notifyTradeOpened(config.telegramBotToken, config.telegramChatId, spread);
    }

    return spread;
  } catch (error) {
    log('error', `[LIVE] Failed to open ${pair.pairId}: ${error.message}`);
    botDb.addLog('error', `[LIVE] Open failed: ${error.message}`, { pair, error: error.message });

    if (telegram && config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
      telegram.notifyError(config.telegramBotToken, config.telegramChatId,
        `Échec ouverture ${pair.pairId}: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Ferme une position en mode live
 */
async function closeLiveSpread(botDb, hlClient, spreadId, reason, config, telegram = null, log = () => {}) {
  if (!hlClient) {
    throw new Error('Hyperliquid client not initialized');
  }

  const spread = botDb.getOpenSpreads().find(s => s.id === spreadId);
  if (!spread) return null;

  log('info', `[LIVE] Closing ${spread.pairId} - ${reason}`);

  try {
    await hlClient.closeSpreadTrade({
      coinA: spread.coinA,
      coinB: spread.coinB,
      positionA: spread.positionA,
      positionB: spread.positionB,
    });

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

    const fees = spread.sizeUSD * 0.002;
    const finalPnL = pnlA + pnlB - fees;

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

    const stats = botDb.getStats();
    botDb.updateStats({
      totalTrades: stats.totalTrades + 1,
      winningTrades: finalPnL > 0 ? stats.winningTrades + 1 : stats.winningTrades,
      totalPnL: stats.totalPnL + finalPnL,
    });

    botDb.addLog('info', `[LIVE] Closed ${spread.pairId}: ${finalPnL.toFixed(2)} USDC`, { trade });

    if (telegram && config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
      telegram.notifyTradeClosed(config.telegramBotToken, config.telegramChatId, trade);
    }

    return trade;
  } catch (error) {
    log('error', `[LIVE] Failed to close ${spread.pairId}: ${error.message}`);
    botDb.addLog('error', `[LIVE] Close failed: ${error.message}`, { spread, error: error.message });

    if (telegram && config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
      telegram.notifyError(config.telegramBotToken, config.telegramChatId,
        `⚠️ ÉCHEC FERMETURE ${spread.pairId}: ${error.message}\nVérifiez vos positions manuellement!`);
    }

    throw error;
  }
}

module.exports = {
  openPaperSpread,
  closePaperSpread,
  openLiveSpread,
  closeLiveSpread,
  updateSpreadsPnL,
  checkExitConditions,
};
