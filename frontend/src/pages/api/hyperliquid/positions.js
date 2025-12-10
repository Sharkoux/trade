// API Route pour récupérer les positions Hyperliquid (lecture seule)

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
    // Récupérer l'état du compte (positions, equity, margin)
    const [clearinghouseState, openOrders] = await Promise.all([
      fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: address,
        }),
      }).then(r => r.json()),

      fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'openOrders',
          user: address,
        }),
      }).then(r => r.json()),
    ]);

    // Parser les positions
    const positions = (clearinghouseState?.assetPositions || []).map(pos => {
      const position = pos.position;
      return {
        coin: position.coin,
        size: parseFloat(position.szi),
        entryPrice: parseFloat(position.entryPx),
        markPrice: parseFloat(position.positionValue) / Math.abs(parseFloat(position.szi)) || 0,
        unrealizedPnl: parseFloat(position.unrealizedPnl),
        leverage: parseFloat(position.leverage?.value || 1),
        liquidationPrice: position.liquidationPx ? parseFloat(position.liquidationPx) : null,
        marginUsed: parseFloat(position.marginUsed),
        side: parseFloat(position.szi) > 0 ? 'LONG' : 'SHORT',
      };
    }).filter(p => p.size !== 0);

    // Infos du compte
    const marginSummary = clearinghouseState?.marginSummary || {};
    const accountValue = parseFloat(marginSummary.accountValue || 0);
    const totalMarginUsed = parseFloat(marginSummary.totalMarginUsed || 0);
    const withdrawable = parseFloat(marginSummary.withdrawable || 0);

    // Calculer le PnL total
    const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

    res.status(200).json({
      address,
      account: {
        equity: accountValue,
        marginUsed: totalMarginUsed,
        freeMargin: withdrawable,
        unrealizedPnl: totalUnrealizedPnl,
      },
      positions,
      openOrders: openOrders || [],
    });
  } catch (error) {
    console.error('Error fetching Hyperliquid positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
}
