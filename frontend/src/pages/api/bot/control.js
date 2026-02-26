// API Route: Contrôle du bot (start, stop, reset, config)
import {
  getBotState,
  updateConfig,
  startBot,
  stopBot,
  resetBot,
  closePaperSpread,
} from '../../../lib/bot-engine';
import { botControlSchema, validateBody } from '../../../lib/validation';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validation des données
  const validation = validateBody(botControlSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error });
  }

  const { action, ...params } = validation.data;

  try {
    let result;

    switch (action) {
      case 'start':
        result = startBot();
        break;

      case 'stop':
        result = stopBot();
        break;

      case 'reset':
        result = resetBot(params.initialBalance || 1000);
        break;

      case 'config':
        result = {
          success: true,
          config: updateConfig(params.config || {}),
        };
        break;

      case 'close-spread':
        if (!params.spreadId) {
          return res.status(400).json({ error: 'spreadId required' });
        }
        const closed = await closePaperSpread(
          params.spreadId,
          params.reason || 'Manual close'
        );
        result = {
          success: !!closed,
          spread: closed,
        };
        break;

      case 'close-all':
        const state = getBotState();
        const closedSpreads = [];
        for (const spread of [...state.openSpreads]) {
          const closed = await closePaperSpread(spread.id, 'Close all positions');
          if (closed) closedSpreads.push(closed);
        }
        result = {
          success: true,
          closed: closedSpreads.length,
          spreads: closedSpreads,
        };
        break;

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    res.status(200).json(result);

  } catch (error) {
    console.error('Bot control error:', error);
    res.status(500).json({ error: error.message });
  }
}
