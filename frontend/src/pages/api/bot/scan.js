// API Route: Scanner les opportunités
import { scanOpportunities, getBotState, canOpenNewSpread } from '../../../lib/bot-engine';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const opportunities = await scanOpportunities();
    const state = getBotState();
    const { allowed, reason } = canOpenNewSpread();

    // Filtrer les paires déjà en position
    const openPairIds = state.openSpreads.map(s => s.pairId);
    const available = opportunities.filter(o => !openPairIds.includes(o.pairId));

    res.status(200).json({
      success: true,
      scan: {
        timestamp: Date.now(),
        totalFound: opportunities.length,
        available: available.length,
        canOpen: allowed,
        blockReason: !allowed ? reason : null,
      },
      config: {
        minQualityStars: state.config.minQualityStars,
        minWinRate: state.config.minWinRate,
        zEntryThreshold: state.config.zEntryThreshold,
        activeUniverses: state.config.activeUniverses,
      },
      opportunities: available.slice(0, 10).map(o => ({
        pairId: o.pairId,
        coinA: o.coinA,
        coinB: o.coinB,
        signal: o.signal,
        zScore: o.zScore,
        qualityStars: o.qualityStars,
        winRate: o.winRate,
        avgReturn: o.avgReturn,
        score: o.score,
        universe: o.universe,
      })),
      openPositions: openPairIds,
    });

  } catch (error) {
    console.error('Bot scan error:', error);
    res.status(500).json({ error: error.message });
  }
}
