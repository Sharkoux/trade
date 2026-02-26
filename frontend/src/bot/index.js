/**
 * Bot Module - Point d'entrée
 *
 * Ce module regroupe tous les composants du bot de trading.
 * Utilisation:
 *   const bot = require('./src/bot');
 *   const opportunities = await bot.scanner.scanOpportunities(config);
 */

const config = require('./config');
const api = require('./api');
const scanner = require('./scanner');
const trader = require('./trader');

module.exports = {
  // Configuration
  config,
  INTERVALS: config.INTERVALS,
  API: config.API,
  UNIVERSES: config.UNIVERSES,
  DEFAULT_BOT_CONFIG: config.DEFAULT_BOT_CONFIG,
  TRADING_LIMITS: config.TRADING_LIMITS,

  // API
  api,
  fetchCandles: api.fetchCandles,
  getMidPrice: api.getMidPrice,
  getAllMidPrices: api.getAllMidPrices,
  clearCaches: api.clearCaches,

  // Scanner
  scanner,
  scanOpportunities: scanner.scanOpportunities,
  generatePairs: scanner.generatePairs,
  computeStatsRatio: scanner.computeStatsRatio,

  // Trader
  trader,
  openPaperSpread: trader.openPaperSpread,
  closePaperSpread: trader.closePaperSpread,
  openLiveSpread: trader.openLiveSpread,
  closeLiveSpread: trader.closeLiveSpread,
  updateSpreadsPnL: trader.updateSpreadsPnL,
  checkExitConditions: trader.checkExitConditions,
};
