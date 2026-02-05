// API Route: Exécuter un cycle du bot
import { runBotCycle, getBotState } from '../../../lib/bot-engine';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const state = getBotState();

    if (!state.isRunning) {
      return res.status(400).json({
        error: 'Bot not running',
        hint: 'Call POST /api/bot/control with action: "start" first',
      });
    }

    const result = await runBotCycle();

    res.status(200).json({
      success: result.executed,
      cycle: {
        ...result,
        timestamp: Date.now(),
      },
      currentState: getBotState(),
    });

  } catch (error) {
    console.error('Bot run error:', error);
    res.status(500).json({ error: error.message });
  }
}
