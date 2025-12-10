// API Route pour récupérer l'historique des trades Hyperliquid (lecture seule)

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }

  try {
    // Récupérer l'historique des fills (trades exécutés)
    const [userFills, fundingHistory] = await Promise.all([
      fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'userFills',
          user: address,
        }),
      }).then(r => r.json()),

      fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'userFunding',
          user: address,
          startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 jours
        }),
      }).then(r => r.json()),
    ]);

    // Parser les trades
    const trades = (userFills || []).map(fill => ({
      id: fill.tid,
      coin: fill.coin,
      side: fill.side,
      size: parseFloat(fill.sz),
      price: parseFloat(fill.px),
      value: parseFloat(fill.sz) * parseFloat(fill.px),
      fee: parseFloat(fill.fee),
      timestamp: fill.time,
      date: new Date(fill.time).toISOString(),
      closedPnl: parseFloat(fill.closedPnl || 0),
      hash: fill.hash,
      crossed: fill.crossed, // true si market order
    }));

    // Grouper par position pour calculer les PnL réalisés
    const tradesByPosition = {};
    trades.forEach(trade => {
      const key = trade.coin;
      if (!tradesByPosition[key]) {
        tradesByPosition[key] = [];
      }
      tradesByPosition[key].push(trade);
    });

    // Calculer les statistiques
    const totalPnl = trades.reduce((sum, t) => sum + t.closedPnl, 0);
    const totalFees = trades.reduce((sum, t) => sum + t.fee, 0);
    const totalVolume = trades.reduce((sum, t) => sum + t.value, 0);

    const winningTrades = trades.filter(t => t.closedPnl > 0);
    const losingTrades = trades.filter(t => t.closedPnl < 0);

    res.status(200).json({
      address,
      trades: trades.sort((a, b) => b.timestamp - a.timestamp), // Plus récent d'abord
      stats: {
        totalTrades: trades.length,
        totalPnl,
        totalFees,
        totalVolume,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
        avgWin: winningTrades.length > 0
          ? winningTrades.reduce((s, t) => s + t.closedPnl, 0) / winningTrades.length
          : 0,
        avgLoss: losingTrades.length > 0
          ? losingTrades.reduce((s, t) => s + t.closedPnl, 0) / losingTrades.length
          : 0,
      },
      funding: fundingHistory || [],
    });
  } catch (error) {
    console.error('Error fetching Hyperliquid history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}
