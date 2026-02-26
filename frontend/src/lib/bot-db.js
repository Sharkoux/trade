// Module de persistence SQLite pour le bot de trading
const Database = require('better-sqlite3');
const path = require('path');
const { encrypt, decrypt } = require('./crypto');

// Chemin de la base de données
const DB_PATH = process.env.BOT_DB_PATH || path.join(process.cwd(), 'data', 'bot.db');

let db = null;

/**
 * Initialise la connexion à la base de données
 */
function getDb() {
  if (db) return db;

  // Créer le dossier data si nécessaire
  const fs = require('fs');
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Créer les tables
  initTables();

  return db;
}

/**
 * Initialise les tables de la base de données
 */
function initTables() {
  const db = getDb();

  // Table de configuration du bot
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER DEFAULT 0,
      mode TEXT DEFAULT 'paper',
      max_position_usd REAL DEFAULT 100,
      max_concurrent_spreads INTEGER DEFAULT 3,
      min_quality_stars INTEGER DEFAULT 4,
      min_win_rate REAL DEFAULT 0.6,
      z_entry_threshold REAL DEFAULT 1.5,
      z_exit_threshold REAL DEFAULT 0.5,
      stop_loss_percent REAL DEFAULT 10,
      active_universes TEXT DEFAULT '["l2","bluechips","defi"]',
      telegram_enabled INTEGER DEFAULT 0,
      telegram_bot_token TEXT,
      telegram_chat_id TEXT,
      api_key TEXT,
      api_secret TEXT,
      wallet_address TEXT,
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Table des stats globales
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      paper_balance REAL DEFAULT 1000,
      total_trades INTEGER DEFAULT 0,
      winning_trades INTEGER DEFAULT 0,
      total_pnl REAL DEFAULT 0,
      peak_equity REAL DEFAULT 1000,
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Table des positions ouvertes
  db.exec(`
    CREATE TABLE IF NOT EXISTS open_spreads (
      id TEXT PRIMARY KEY,
      pair_id TEXT NOT NULL,
      coin_a TEXT NOT NULL,
      coin_b TEXT NOT NULL,
      signal TEXT NOT NULL,
      size_usd REAL NOT NULL,
      position_a_side TEXT,
      position_a_entry_price REAL,
      position_a_size REAL,
      position_b_side TEXT,
      position_b_entry_price REAL,
      position_b_size REAL,
      entry_ratio REAL,
      entry_z_score REAL,
      entry_time INTEGER,
      current_pnl REAL DEFAULT 0,
      current_ratio REAL,
      last_update INTEGER,
      mode TEXT DEFAULT 'paper'
    )
  `);

  // Table de l'historique des trades
  db.exec(`
    CREATE TABLE IF NOT EXISTS trade_history (
      id TEXT PRIMARY KEY,
      pair_id TEXT NOT NULL,
      coin_a TEXT NOT NULL,
      coin_b TEXT NOT NULL,
      signal TEXT NOT NULL,
      size_usd REAL NOT NULL,
      position_a_side TEXT,
      position_a_entry_price REAL,
      position_a_exit_price REAL,
      position_a_size REAL,
      position_b_side TEXT,
      position_b_entry_price REAL,
      position_b_exit_price REAL,
      position_b_size REAL,
      entry_ratio REAL,
      entry_z_score REAL,
      entry_time INTEGER,
      exit_ratio REAL,
      exit_time INTEGER,
      exit_reason TEXT,
      final_pnl REAL,
      mode TEXT DEFAULT 'paper',
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Table des logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      level TEXT DEFAULT 'info',
      message TEXT,
      data TEXT
    )
  `);

  // Table des paramètres optimisés par paire
  db.exec(`
    CREATE TABLE IF NOT EXISTS optimized_params (
      pair_id TEXT PRIMARY KEY,
      coin_a TEXT NOT NULL,
      coin_b TEXT NOT NULL,
      z_entry REAL NOT NULL,
      z_exit REAL NOT NULL,
      win_rate REAL,
      avg_return REAL,
      score REAL,
      optimized_at INTEGER,
      expires_at INTEGER
    )
  `);

  // Table du worker (heartbeat)
  db.exec(`
    CREATE TABLE IF NOT EXISTS worker_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      pid INTEGER,
      started_at INTEGER,
      last_heartbeat INTEGER,
      last_cycle INTEGER,
      cycles_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'stopped'
    )
  `);

  // ============ INDEX POUR PERFORMANCES ============

  // Index sur l'historique des trades (requêtes fréquentes par date)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trade_history_exit_time
    ON trade_history(exit_time DESC)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trade_history_pair_id
    ON trade_history(pair_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trade_history_mode
    ON trade_history(mode)
  `);

  // Index sur les positions ouvertes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_open_spreads_entry_time
    ON open_spreads(entry_time ASC)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_open_spreads_pair_id
    ON open_spreads(pair_id)
  `);

  // Index sur les logs (requêtes par timestamp)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bot_logs_timestamp
    ON bot_logs(timestamp DESC)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bot_logs_level
    ON bot_logs(level)
  `);

  // Index sur les paramètres optimisés
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_optimized_params_expires
    ON optimized_params(expires_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_optimized_params_score
    ON optimized_params(score DESC)
  `);

  const workerExists = db.prepare('SELECT COUNT(*) as count FROM worker_status').get();
  if (workerExists.count === 0) {
    db.prepare("INSERT INTO worker_status (id, status) VALUES (1, 'stopped')").run();
  }

  // Insérer les valeurs par défaut si nécessaire
  const configExists = db.prepare('SELECT COUNT(*) as count FROM bot_config').get();
  if (configExists.count === 0) {
    db.prepare('INSERT INTO bot_config (id) VALUES (1)').run();
  }

  const statsExists = db.prepare('SELECT COUNT(*) as count FROM bot_stats').get();
  if (statsExists.count === 0) {
    db.prepare('INSERT INTO bot_stats (id) VALUES (1)').run();
  }
}

// ============ CONFIG ============

/**
 * Récupère la configuration du bot
 */
function getConfig() {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bot_config WHERE id = 1').get();

  return {
    enabled: row.enabled === 1,
    mode: row.mode,
    maxPositionUSD: row.max_position_usd,
    maxConcurrentSpreads: row.max_concurrent_spreads,
    minQualityStars: row.min_quality_stars,
    minWinRate: row.min_win_rate,
    zEntryThreshold: row.z_entry_threshold,
    zExitThreshold: row.z_exit_threshold,
    stopLossPercent: row.stop_loss_percent,
    activeUniverses: JSON.parse(row.active_universes),
    telegramEnabled: row.telegram_enabled === 1,
    telegramBotToken: decrypt(row.telegram_bot_token),
    telegramChatId: row.telegram_chat_id,
    apiKey: decrypt(row.api_key),
    apiSecret: decrypt(row.api_secret),
    walletAddress: row.wallet_address,
  };
}

/**
 * Met à jour la configuration du bot
 */
function updateConfig(config) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE bot_config SET
      enabled = COALESCE(@enabled, enabled),
      mode = COALESCE(@mode, mode),
      max_position_usd = COALESCE(@maxPositionUSD, max_position_usd),
      max_concurrent_spreads = COALESCE(@maxConcurrentSpreads, max_concurrent_spreads),
      min_quality_stars = COALESCE(@minQualityStars, min_quality_stars),
      min_win_rate = COALESCE(@minWinRate, min_win_rate),
      z_entry_threshold = COALESCE(@zEntryThreshold, z_entry_threshold),
      z_exit_threshold = COALESCE(@zExitThreshold, z_exit_threshold),
      stop_loss_percent = COALESCE(@stopLossPercent, stop_loss_percent),
      active_universes = COALESCE(@activeUniverses, active_universes),
      telegram_enabled = COALESCE(@telegramEnabled, telegram_enabled),
      telegram_bot_token = COALESCE(@telegramBotToken, telegram_bot_token),
      telegram_chat_id = COALESCE(@telegramChatId, telegram_chat_id),
      api_key = COALESCE(@apiKey, api_key),
      api_secret = COALESCE(@apiSecret, api_secret),
      wallet_address = COALESCE(@walletAddress, wallet_address),
      updated_at = @updatedAt
    WHERE id = 1
  `);

  stmt.run({
    enabled: config.enabled !== undefined ? (config.enabled ? 1 : 0) : null,
    mode: config.mode || null,
    maxPositionUSD: config.maxPositionUSD || null,
    maxConcurrentSpreads: config.maxConcurrentSpreads || null,
    minQualityStars: config.minQualityStars || null,
    minWinRate: config.minWinRate || null,
    zEntryThreshold: config.zEntryThreshold || null,
    zExitThreshold: config.zExitThreshold || null,
    stopLossPercent: config.stopLossPercent || null,
    activeUniverses: config.activeUniverses ? JSON.stringify(config.activeUniverses) : null,
    telegramEnabled: config.telegramEnabled !== undefined ? (config.telegramEnabled ? 1 : 0) : null,
    telegramBotToken: config.telegramBotToken !== undefined ? encrypt(config.telegramBotToken) : null,
    telegramChatId: config.telegramChatId !== undefined ? config.telegramChatId : null,
    apiKey: config.apiKey !== undefined ? encrypt(config.apiKey) : null,
    apiSecret: config.apiSecret !== undefined ? encrypt(config.apiSecret) : null,
    walletAddress: config.walletAddress !== undefined ? config.walletAddress : null,
    updatedAt: Date.now(),
  });

  return getConfig();
}

/**
 * Active/désactive le bot
 */
function setEnabled(enabled) {
  const db = getDb();
  db.prepare('UPDATE bot_config SET enabled = ?, updated_at = ? WHERE id = 1')
    .run(enabled ? 1 : 0, Date.now());
}

// ============ STATS ============

/**
 * Récupère les stats du bot
 */
function getStats() {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bot_stats WHERE id = 1').get();

  return {
    paperBalance: row.paper_balance,
    totalTrades: row.total_trades,
    winningTrades: row.winning_trades,
    totalPnL: row.total_pnl,
    peakEquity: row.peak_equity,
  };
}

/**
 * Met à jour les stats du bot
 */
function updateStats(stats) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE bot_stats SET
      paper_balance = COALESCE(@paperBalance, paper_balance),
      total_trades = COALESCE(@totalTrades, total_trades),
      winning_trades = COALESCE(@winningTrades, winning_trades),
      total_pnl = COALESCE(@totalPnL, total_pnl),
      peak_equity = COALESCE(@peakEquity, peak_equity),
      updated_at = @updatedAt
    WHERE id = 1
  `);

  stmt.run({
    paperBalance: stats.paperBalance ?? null,
    totalTrades: stats.totalTrades ?? null,
    winningTrades: stats.winningTrades ?? null,
    totalPnL: stats.totalPnL ?? null,
    peakEquity: stats.peakEquity ?? null,
    updatedAt: Date.now(),
  });

  return getStats();
}

/**
 * Reset les stats
 */
function resetStats(initialBalance = 1000) {
  const db = getDb();
  db.prepare(`
    UPDATE bot_stats SET
      paper_balance = ?,
      total_trades = 0,
      winning_trades = 0,
      total_pnl = 0,
      peak_equity = ?,
      updated_at = ?
    WHERE id = 1
  `).run(initialBalance, initialBalance, Date.now());

  // Supprimer les positions ouvertes
  db.prepare('DELETE FROM open_spreads').run();

  return getStats();
}

// ============ POSITIONS ============

/**
 * Récupère toutes les positions ouvertes
 */
function getOpenSpreads() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM open_spreads ORDER BY entry_time ASC').all();

  return rows.map(row => ({
    id: row.id,
    pairId: row.pair_id,
    coinA: row.coin_a,
    coinB: row.coin_b,
    signal: row.signal,
    sizeUSD: row.size_usd,
    positionA: {
      side: row.position_a_side,
      entryPrice: row.position_a_entry_price,
      size: row.position_a_size,
    },
    positionB: {
      side: row.position_b_side,
      entryPrice: row.position_b_entry_price,
      size: row.position_b_size,
    },
    entryRatio: row.entry_ratio,
    entryZScore: row.entry_z_score,
    entryTime: row.entry_time,
    currentPnL: row.current_pnl,
    currentRatio: row.current_ratio,
    lastUpdate: row.last_update,
    mode: row.mode,
    status: 'open',
  }));
}

/**
 * Ajoute une nouvelle position
 */
function addOpenSpread(spread) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO open_spreads (
      id, pair_id, coin_a, coin_b, signal, size_usd,
      position_a_side, position_a_entry_price, position_a_size,
      position_b_side, position_b_entry_price, position_b_size,
      entry_ratio, entry_z_score, entry_time, current_pnl, mode
    ) VALUES (
      @id, @pairId, @coinA, @coinB, @signal, @sizeUSD,
      @positionASide, @positionAEntryPrice, @positionASize,
      @positionBSide, @positionBEntryPrice, @positionBSize,
      @entryRatio, @entryZScore, @entryTime, @currentPnL, @mode
    )
  `);

  stmt.run({
    id: spread.id,
    pairId: spread.pairId,
    coinA: spread.coinA,
    coinB: spread.coinB,
    signal: spread.signal,
    sizeUSD: spread.sizeUSD,
    positionASide: spread.positionA.side,
    positionAEntryPrice: spread.positionA.entryPrice,
    positionASize: spread.positionA.size,
    positionBSide: spread.positionB.side,
    positionBEntryPrice: spread.positionB.entryPrice,
    positionBSize: spread.positionB.size,
    entryRatio: spread.entryRatio,
    entryZScore: spread.entryZScore,
    entryTime: spread.entryTime,
    currentPnL: spread.currentPnL || 0,
    mode: spread.mode || 'paper',
  });

  return spread;
}

/**
 * Met à jour le PnL d'une position
 */
function updateSpreadPnL(spreadId, currentPnL, currentRatio) {
  const db = getDb();
  db.prepare(`
    UPDATE open_spreads SET
      current_pnl = ?,
      current_ratio = ?,
      last_update = ?
    WHERE id = ?
  `).run(currentPnL, currentRatio, Date.now(), spreadId);
}

/**
 * Supprime une position (la ferme)
 */
function removeOpenSpread(spreadId) {
  const db = getDb();
  const spread = db.prepare('SELECT * FROM open_spreads WHERE id = ?').get(spreadId);
  db.prepare('DELETE FROM open_spreads WHERE id = ?').run(spreadId);
  return spread;
}

// ============ HISTORIQUE ============

/**
 * Ajoute un trade à l'historique
 */
function addTradeHistory(trade) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO trade_history (
      id, pair_id, coin_a, coin_b, signal, size_usd,
      position_a_side, position_a_entry_price, position_a_exit_price, position_a_size,
      position_b_side, position_b_entry_price, position_b_exit_price, position_b_size,
      entry_ratio, entry_z_score, entry_time,
      exit_ratio, exit_time, exit_reason, final_pnl, mode
    ) VALUES (
      @id, @pairId, @coinA, @coinB, @signal, @sizeUSD,
      @positionASide, @positionAEntryPrice, @positionAExitPrice, @positionASize,
      @positionBSide, @positionBEntryPrice, @positionBExitPrice, @positionBSize,
      @entryRatio, @entryZScore, @entryTime,
      @exitRatio, @exitTime, @exitReason, @finalPnL, @mode
    )
  `);

  stmt.run({
    id: trade.id,
    pairId: trade.pairId,
    coinA: trade.coinA,
    coinB: trade.coinB,
    signal: trade.signal,
    sizeUSD: trade.sizeUSD,
    positionASide: trade.positionA?.side,
    positionAEntryPrice: trade.positionA?.entryPrice,
    positionAExitPrice: trade.positionA?.exitPrice,
    positionASize: trade.positionA?.size,
    positionBSide: trade.positionB?.side,
    positionBEntryPrice: trade.positionB?.entryPrice,
    positionBExitPrice: trade.positionB?.exitPrice,
    positionBSize: trade.positionB?.size,
    entryRatio: trade.entryRatio,
    entryZScore: trade.entryZScore,
    entryTime: trade.entryTime,
    exitRatio: trade.exitRatio,
    exitTime: trade.exitTime,
    exitReason: trade.exitReason,
    finalPnL: trade.finalPnL,
    mode: trade.mode || 'paper',
  });

  return trade;
}

/**
 * Récupère l'historique des trades
 */
function getTradeHistory(limit = 50) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM trade_history
    ORDER BY exit_time DESC
    LIMIT ?
  `).all(limit);

  return rows.map(row => ({
    id: row.id,
    pairId: row.pair_id,
    coinA: row.coin_a,
    coinB: row.coin_b,
    signal: row.signal,
    sizeUSD: row.size_usd,
    positionA: {
      side: row.position_a_side,
      entryPrice: row.position_a_entry_price,
      exitPrice: row.position_a_exit_price,
      size: row.position_a_size,
    },
    positionB: {
      side: row.position_b_side,
      entryPrice: row.position_b_entry_price,
      exitPrice: row.position_b_exit_price,
      size: row.position_b_size,
    },
    entryRatio: row.entry_ratio,
    entryZScore: row.entry_z_score,
    entryTime: row.entry_time,
    exitRatio: row.exit_ratio,
    exitTime: row.exit_time,
    exitReason: row.exit_reason,
    finalPnL: row.final_pnl,
    mode: row.mode,
    status: 'closed',
  }));
}

// ============ LOGS ============

/**
 * Ajoute un log
 */
function addLog(level, message, data = null) {
  const db = getDb();
  db.prepare(`
    INSERT INTO bot_logs (timestamp, level, message, data)
    VALUES (?, ?, ?, ?)
  `).run(Date.now(), level, message, data ? JSON.stringify(data) : null);
}

/**
 * Récupère les derniers logs
 */
function getLogs(limit = 100) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM bot_logs
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit);

  return rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    level: row.level,
    message: row.message,
    data: row.data ? JSON.parse(row.data) : null,
  })).reverse();
}

/**
 * Nettoie les vieux logs (garde les 7 derniers jours)
 */
function cleanOldLogs() {
  const db = getDb();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM bot_logs WHERE timestamp < ?').run(sevenDaysAgo);
}

// ============ WORKER STATUS ============

/**
 * Met à jour le heartbeat du worker
 */
function updateWorkerHeartbeat(cycleCompleted = false) {
  const db = getDb();
  const now = Date.now();

  if (cycleCompleted) {
    db.prepare(`
      UPDATE worker_status SET
        last_heartbeat = ?,
        last_cycle = ?,
        cycles_count = cycles_count + 1
      WHERE id = 1
    `).run(now, now);
  } else {
    db.prepare('UPDATE worker_status SET last_heartbeat = ? WHERE id = 1').run(now);
  }
}

/**
 * Marque le worker comme démarré
 */
function setWorkerStarted() {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    UPDATE worker_status SET
      pid = ?,
      started_at = ?,
      last_heartbeat = ?,
      status = 'running'
    WHERE id = 1
  `).run(process.pid, now, now);
}

/**
 * Marque le worker comme arrêté
 */
function setWorkerStopped() {
  const db = getDb();
  db.prepare(`
    UPDATE worker_status SET
      pid = NULL,
      status = 'stopped'
    WHERE id = 1
  `).run();
}

/**
 * Récupère le statut du worker
 */
function getWorkerStatus() {
  const db = getDb();
  const row = db.prepare('SELECT * FROM worker_status WHERE id = 1').get();

  if (!row) {
    return { isRunning: false, status: 'unknown' };
  }

  // Vérifier si le heartbeat est récent (< 2 minutes)
  const now = Date.now();
  const heartbeatAge = row.last_heartbeat ? now - row.last_heartbeat : Infinity;
  const isAlive = heartbeatAge < 120000; // 2 minutes

  return {
    isRunning: row.status === 'running' && isAlive,
    status: isAlive ? row.status : 'disconnected',
    pid: row.pid,
    startedAt: row.started_at,
    lastHeartbeat: row.last_heartbeat,
    lastCycle: row.last_cycle,
    cyclesCount: row.cycles_count,
    heartbeatAge: Math.round(heartbeatAge / 1000),
  };
}

// ============ OPTIMIZED PARAMS ============

/**
 * Récupère les paramètres optimisés pour une paire
 */
function getOptimizedParams(pairId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM optimized_params WHERE pair_id = ?').get(pairId);

  if (!row) return null;

  return {
    pairId: row.pair_id,
    coinA: row.coin_a,
    coinB: row.coin_b,
    zEntry: row.z_entry,
    zExit: row.z_exit,
    winRate: row.win_rate,
    avgReturn: row.avg_return,
    score: row.score,
    optimizedAt: row.optimized_at,
    expiresAt: row.expires_at,
    isExpired: Date.now() > row.expires_at,
  };
}

/**
 * Sauvegarde les paramètres optimisés pour une paire
 */
function setOptimizedParams(params) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO optimized_params (
      pair_id, coin_a, coin_b, z_entry, z_exit,
      win_rate, avg_return, score, optimized_at, expires_at
    ) VALUES (
      @pairId, @coinA, @coinB, @zEntry, @zExit,
      @winRate, @avgReturn, @score, @optimizedAt, @expiresAt
    )
  `);

  stmt.run({
    pairId: params.pairId,
    coinA: params.coinA,
    coinB: params.coinB,
    zEntry: params.zEntry,
    zExit: params.zExit,
    winRate: params.winRate || null,
    avgReturn: params.avgReturn || null,
    score: params.score || null,
    optimizedAt: params.optimizedAt || Date.now(),
    expiresAt: params.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return getOptimizedParams(params.pairId);
}

/**
 * Récupère tous les paramètres optimisés
 */
function getAllOptimizedParams() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM optimized_params ORDER BY score DESC').all();

  return rows.map(row => ({
    pairId: row.pair_id,
    coinA: row.coin_a,
    coinB: row.coin_b,
    zEntry: row.z_entry,
    zExit: row.z_exit,
    winRate: row.win_rate,
    avgReturn: row.avg_return,
    score: row.score,
    optimizedAt: row.optimized_at,
    expiresAt: row.expires_at,
    isExpired: Date.now() > row.expires_at,
  }));
}

/**
 * Supprime les paramètres optimisés d'une paire
 */
function deleteOptimizedParams(pairId) {
  const db = getDb();
  db.prepare('DELETE FROM optimized_params WHERE pair_id = ?').run(pairId);
}

/**
 * Nettoie les paramètres expirés
 */
function cleanExpiredParams() {
  const db = getDb();
  const result = db.prepare('DELETE FROM optimized_params WHERE expires_at < ?').run(Date.now());
  return result.changes;
}

/**
 * Ferme la connexion à la base de données
 */
function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  initTables,
  // Config
  getConfig,
  updateConfig,
  setEnabled,
  // Stats
  getStats,
  updateStats,
  resetStats,
  // Positions
  getOpenSpreads,
  addOpenSpread,
  updateSpreadPnL,
  removeOpenSpread,
  // Historique
  addTradeHistory,
  getTradeHistory,
  // Logs
  addLog,
  getLogs,
  cleanOldLogs,
  // Worker
  updateWorkerHeartbeat,
  setWorkerStarted,
  setWorkerStopped,
  getWorkerStatus,
  // Optimized params
  getOptimizedParams,
  setOptimizedParams,
  getAllOptimizedParams,
  deleteOptimizedParams,
  cleanExpiredParams,
  // Utils
  close,
};
