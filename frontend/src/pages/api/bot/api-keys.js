// API Route: Configuration des API Keys Hyperliquid
import { apiKeysSchema, validateBody } from '../../../lib/validation';

let botDb;
let hlApi;

try {
  botDb = require('../../../lib/bot-db.js');
  hlApi = require('../../../lib/hyperliquid-api.js');
} catch (e) {
  console.error('Failed to load modules:', e);
}

export default async function handler(req, res) {
  if (!botDb) {
    return res.status(500).json({ error: 'Database module not available' });
  }

  if (req.method === 'GET') {
    // Récupérer la config API (masquer le secret)
    try {
      const config = botDb.getConfig();
      res.status(200).json({
        success: true,
        apiKeys: {
          configured: !!(config.apiKey && config.apiSecret && config.walletAddress),
          apiKey: config.apiKey ? `${config.apiKey.slice(0, 8)}...` : null,
          walletAddress: config.walletAddress,
          mode: config.mode,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'POST') {
    // Validation des données
    const validation = validateBody(apiKeysSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const { action, apiKey, apiSecret, walletAddress, mode } = validation.data;

    try {
      switch (action) {
        case 'test': {
          // Tester la connexion avec les clés fournies
          if (!apiKey || !apiSecret || !walletAddress) {
            return res.status(400).json({
              error: 'apiKey, apiSecret et walletAddress requis'
            });
          }

          if (!hlApi) {
            return res.status(500).json({ error: 'API module not available' });
          }

          const client = hlApi.createClient({ apiKey, apiSecret, walletAddress });
          const result = await client.testConnection();

          if (result.success) {
            res.status(200).json({
              success: true,
              message: result.message,
              balance: result.balance,
            });
          } else {
            res.status(400).json({
              success: false,
              error: result.error || 'Échec de connexion',
            });
          }
          break;
        }

        case 'configure': {
          // Sauvegarder les clés API (validation déjà faite par zod)
          if (!apiKey || !apiSecret || !walletAddress) {
            return res.status(400).json({
              error: 'apiKey, apiSecret et walletAddress requis'
            });
          }

          botDb.updateConfig({
            apiKey,
            apiSecret,
            walletAddress,
          });

          res.status(200).json({
            success: true,
            message: 'API Keys configurées avec succès',
          });
          break;
        }

        case 'remove': {
          // Supprimer les clés API et repasser en mode paper
          botDb.updateConfig({
            apiKey: '',
            apiSecret: '',
            walletAddress: '',
            mode: 'paper',
          });

          res.status(200).json({
            success: true,
            message: 'API Keys supprimées, mode paper activé',
          });
          break;
        }

        case 'set-mode': {
          // Changer le mode (paper/live) - validation déjà faite par zod
          if (!mode) {
            return res.status(400).json({ error: 'Mode requis' });
          }

          // Vérifier que les clés sont configurées pour le mode live
          if (mode === 'live') {
            const config = botDb.getConfig();
            if (!config.apiKey || !config.apiSecret || !config.walletAddress) {
              return res.status(400).json({
                error: 'Configurez les API Keys avant de passer en mode live',
              });
            }
          }

          botDb.updateConfig({ mode });

          res.status(200).json({
            success: true,
            message: `Mode ${mode} activé`,
          });
          break;
        }

        default:
          res.status(400).json({ error: `Action inconnue: ${action}` });
      }
    } catch (error) {
      console.error('API Keys error:', error);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
