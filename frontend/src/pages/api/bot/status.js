// API Route: Statut du bot
import { getBotState, updateSpreadsPnL } from '../../../lib/bot-engine';

// Import dynamique pour le worker status
let botDb;
try {
  botDb = require('../../../lib/bot-db.js');
} catch (e) {
  botDb = null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Mettre à jour les PnL avant de retourner le statut
    const state = getBotState();

    if (state.openSpreads.length > 0) {
      await updateSpreadsPnL();
    }

    const updatedState = getBotState();

    // Récupérer le statut du worker
    const workerStatus = botDb ? botDb.getWorkerStatus() : { isRunning: false, status: 'unknown' };

    res.status(200).json({
      success: true,
      bot: {
        isRunning: updatedState.isRunning,
        mode: updatedState.config.mode,
        lastScan: updatedState.lastScan,
        lastCheck: updatedState.lastCheck,
      },
      worker: workerStatus,
      config: updatedState.config,
      positions: {
        open: updatedState.openSpreads,
        count: updatedState.openSpreads.length,
        maxAllowed: updatedState.config.maxConcurrentSpreads,
      },
      paper: {
        balance: updatedState.paperBalance,
        equity: updatedState.paperEquity,
        unrealizedPnL: updatedState.paperEquity - updatedState.paperBalance,
      },
      stats: updatedState.stats,
      recentHistory: updatedState.tradeHistory.slice(-10).reverse(),
    });

  } catch (error) {
    console.error('Bot status error:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
}
