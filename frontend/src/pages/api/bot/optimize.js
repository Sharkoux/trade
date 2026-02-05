// API Route: Optimisation des z-thresholds
const API_BASE = 'https://api.hyperliquid.xyz/info';

let botDb;
let optimizer;

try {
  botDb = require('../../../lib/bot-db.js');
  optimizer = require('../../../lib/optimizer.js');
} catch (e) {
  console.error('Failed to load modules:', e);
}

// Récupérer les candles historiques
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

export default async function handler(req, res) {
  if (!botDb || !optimizer) {
    return res.status(500).json({ error: 'Modules not available' });
  }

  // GET: Récupérer les paramètres optimisés
  if (req.method === 'GET') {
    const { pairId } = req.query;

    try {
      if (pairId) {
        // Paramètres pour une paire spécifique
        const params = botDb.getOptimizedParams(pairId);
        if (params) {
          return res.status(200).json({ success: true, params });
        } else {
          return res.status(404).json({ success: false, error: 'No optimized params for this pair' });
        }
      } else {
        // Tous les paramètres optimisés
        const allParams = botDb.getAllOptimizedParams();
        const validCount = allParams.filter(p => !p.isExpired).length;

        return res.status(200).json({
          success: true,
          params: allParams,
          summary: {
            total: allParams.length,
            valid: validCount,
            expired: allParams.length - validCount,
          },
        });
      }
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST: Lancer une optimisation
  if (req.method === 'POST') {
    const { action, pairId, coinA, coinB, options } = req.body;

    try {
      switch (action) {
        case 'optimize': {
          // Optimiser une paire spécifique
          if (!coinA || !coinB) {
            return res.status(400).json({ error: 'coinA et coinB requis' });
          }

          const pair = pairId || `${coinA}-${coinB}`.toLowerCase();

          // Récupérer les données historiques
          const now = Date.now();
          const startTime = now - 365 * 24 * 60 * 60 * 1000; // 1 an

          const [candlesA, candlesB] = await Promise.all([
            fetchCandles(coinA, '1d', startTime, now),
            fetchCandles(coinB, '1d', startTime, now),
          ]);

          const seriesA = candlesA.map(c => ({ t: c.t, c: parseFloat(c.c) }));
          const seriesB = candlesB.map(c => ({ t: c.t, c: parseFloat(c.c) }));

          // Lancer l'optimisation
          const result = optimizer.optimizePair(seriesA, seriesB, options);

          if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
          }

          // Sauvegarder les paramètres optimaux
          const saved = botDb.setOptimizedParams({
            pairId: pair,
            coinA,
            coinB,
            zEntry: result.optimal.zEntry,
            zExit: result.optimal.zExit,
            winRate: result.optimal.winRate,
            avgReturn: result.optimal.avgReturn,
            score: result.optimal.score,
          });

          return res.status(200).json({
            success: true,
            pairId: pair,
            result,
            saved,
          });
        }

        case 'optimize-all': {
          // Optimiser toutes les paires actives (universes)
          const UNIVERSES = {
            l2: ['OP', 'ARB', 'MNT', 'STRK', 'ZK', 'MATIC', 'IMX', 'METIS', 'MANTA', 'BLAST'],
            bluechips: ['BTC', 'ETH', 'SOL', 'AVAX', 'BNB', 'LINK'],
            defi: ['AAVE', 'COMP', 'MKR', 'SNX', 'LDO', 'PENDLE'],
          };

          const config = botDb.getConfig();
          const universes = options?.universes || config.activeUniverses || ['l2', 'bluechips', 'defi'];

          // Collecter tous les coins uniques
          const uniqueCoins = new Set();
          for (const universe of universes) {
            const coins = UNIVERSES[universe] || [];
            coins.forEach(c => uniqueCoins.add(c));
          }

          const coinsArray = [...uniqueCoins];

          // Récupérer toutes les données
          const now = Date.now();
          const startTime = now - 365 * 24 * 60 * 60 * 1000;

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

          // Générer les paires et optimiser
          const results = [];
          const errors = [];

          for (let i = 0; i < coinsArray.length; i++) {
            for (let j = i + 1; j < coinsArray.length; j++) {
              const coinA = coinsArray[i];
              const coinB = coinsArray[j];
              const pair = `${coinA}-${coinB}`.toLowerCase();

              const seriesA = candlesMap[coinA];
              const seriesB = candlesMap[coinB];

              if (!seriesA || !seriesB) {
                errors.push({ pair, error: 'Missing data' });
                continue;
              }

              try {
                const result = optimizer.optimizePair(seriesA, seriesB, options);

                if (result.success) {
                  // Sauvegarder
                  botDb.setOptimizedParams({
                    pairId: pair,
                    coinA,
                    coinB,
                    zEntry: result.optimal.zEntry,
                    zExit: result.optimal.zExit,
                    winRate: result.optimal.winRate,
                    avgReturn: result.optimal.avgReturn,
                    score: result.optimal.score,
                  });

                  results.push({
                    pair,
                    zEntry: result.optimal.zEntry,
                    zExit: result.optimal.zExit,
                    winRate: result.optimal.winRate,
                    avgReturn: result.optimal.avgReturn,
                    improvement: result.improvement,
                  });
                } else {
                  errors.push({ pair, error: result.error });
                }
              } catch (e) {
                errors.push({ pair, error: e.message });
              }
            }
          }

          // Trier par performance
          results.sort((a, b) => b.avgReturn - a.avgReturn);

          return res.status(200).json({
            success: true,
            optimized: results.length,
            failed: errors.length,
            results: results.slice(0, 20), // Top 20
            errors: errors.slice(0, 10),
          });
        }

        case 'clean': {
          // Nettoyer les paramètres expirés
          const cleaned = botDb.cleanExpiredParams();
          return res.status(200).json({
            success: true,
            cleaned,
            message: `${cleaned} paramètres expirés supprimés`,
          });
        }

        case 'delete': {
          // Supprimer les paramètres d'une paire
          if (!pairId) {
            return res.status(400).json({ error: 'pairId requis' });
          }

          botDb.deleteOptimizedParams(pairId);
          return res.status(200).json({
            success: true,
            message: `Paramètres de ${pairId} supprimés`,
          });
        }

        default:
          return res.status(400).json({ error: `Action inconnue: ${action}` });
      }
    } catch (error) {
      console.error('Optimize API error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
