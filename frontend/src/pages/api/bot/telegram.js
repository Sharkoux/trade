// API Route: Configuration Telegram
let botDb;
let telegram;

try {
  botDb = require('../../../lib/bot-db.js');
  telegram = require('../../../lib/telegram.js');
} catch (e) {
  console.error('Failed to load modules:', e);
}

export default async function handler(req, res) {
  if (!botDb || !telegram) {
    return res.status(500).json({ error: 'Modules not available' });
  }

  if (req.method === 'GET') {
    // Récupérer la config Telegram
    try {
      const config = botDb.getConfig();
      res.status(200).json({
        success: true,
        telegram: {
          enabled: config.telegramEnabled,
          botToken: config.telegramBotToken ? '***configured***' : null,
          chatId: config.telegramChatId,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'POST') {
    const { action, botToken, chatId, enabled } = req.body;

    try {
      switch (action) {
        case 'test': {
          // Tester la connexion
          if (!botToken || !chatId) {
            return res.status(400).json({ error: 'botToken et chatId requis' });
          }

          const success = await telegram.testConnection(botToken, chatId);
          if (success) {
            res.status(200).json({ success: true, message: 'Connexion réussie ! Vérifiez Telegram.' });
          } else {
            res.status(400).json({ success: false, error: 'Échec de connexion. Vérifiez le token et le chat ID.' });
          }
          break;
        }

        case 'configure': {
          // Sauvegarder la configuration
          botDb.updateConfig({
            telegramEnabled: enabled !== undefined ? enabled : true,
            telegramBotToken: botToken || undefined,
            telegramChatId: chatId || undefined,
          });

          res.status(200).json({ success: true, message: 'Configuration sauvegardée' });
          break;
        }

        case 'enable': {
          botDb.updateConfig({ telegramEnabled: true });
          res.status(200).json({ success: true, message: 'Notifications activées' });
          break;
        }

        case 'disable': {
          botDb.updateConfig({ telegramEnabled: false });
          res.status(200).json({ success: true, message: 'Notifications désactivées' });
          break;
        }

        case 'send-status': {
          // Envoyer un rapport de statut
          const config = botDb.getConfig();
          if (!config.telegramEnabled || !config.telegramBotToken || !config.telegramChatId) {
            return res.status(400).json({ error: 'Telegram non configuré' });
          }

          const stats = botDb.getStats();
          const spreads = botDb.getOpenSpreads();
          const totalPnL = spreads.reduce((sum, s) => sum + (s.currentPnL || 0), 0);

          await telegram.notifyStatus(
            config.telegramBotToken,
            config.telegramChatId,
            {
              ...stats,
              paperEquity: stats.paperBalance + totalPnL,
            },
            spreads
          );

          res.status(200).json({ success: true, message: 'Rapport envoyé' });
          break;
        }

        default:
          res.status(400).json({ error: `Action inconnue: ${action}` });
      }
    } catch (error) {
      console.error('Telegram API error:', error);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
