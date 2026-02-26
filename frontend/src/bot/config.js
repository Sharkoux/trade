/**
 * Configuration du bot de trading
 */

// Intervalles de temps (ms)
const INTERVALS = {
  SCAN: 60000,        // Scanner toutes les 60s
  CHECK: 30000,       // Vérifier positions toutes les 30s
  CLEANUP: 3600000,   // Nettoyer logs toutes les heures
  DAILY_REPORT_HOUR: 20, // Rapport journalier à 20h
};

// API Hyperliquid
const API = {
  INFO: 'https://api.hyperliquid.xyz/info',
  EXCHANGE: 'https://api.hyperliquid.xyz/exchange',
};

// Univers de coins disponibles
const UNIVERSES = {
  l2: ['OP', 'ARB', 'MNT', 'STRK', 'ZK', 'MATIC', 'IMX', 'METIS', 'MANTA', 'BLAST'],
  dex: ['UNI', 'SUSHI', 'GMX', 'APEX', 'DYDX', 'CRV', 'BAL', 'VELO', 'JUP', 'RAY'],
  bluechips: ['BTC', 'ETH', 'SOL', 'AVAX', 'BNB', 'LINK', 'DOT', 'ATOM'],
  defi: ['AAVE', 'COMP', 'MKR', 'SNX', 'LDO', 'RPL', 'FXS', 'PENDLE'],
  ai: ['FET', 'RNDR', 'AGIX', 'TAO', 'AR', 'FIL', 'GRT', 'OCEAN'],
  meme: ['DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'FLOKI'],
};

// Configuration par défaut du bot
const DEFAULT_BOT_CONFIG = {
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

// Limites de trading
const TRADING_LIMITS = {
  MAX_HOLDING_TIME_MS: 7 * 24 * 60 * 60 * 1000, // 7 jours
  TAKE_PROFIT_PERCENT: 8,
  MIN_DATA_POINTS: 20,
  LOOKBACK_DAYS: 90,
};

module.exports = {
  INTERVALS,
  API,
  UNIVERSES,
  DEFAULT_BOT_CONFIG,
  TRADING_LIMITS,
};
