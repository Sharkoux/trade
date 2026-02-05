// Module Telegram pour les notifications du bot
const TELEGRAM_API = 'https://api.telegram.org/bot';

/**
 * Envoie un message Telegram
 */
async function sendMessage(botToken, chatId, text, options = {}) {
  if (!botToken || !chatId) {
    console.log('[Telegram] Token ou Chat ID manquant, notification ignorée');
    return null;
  }

  try {
    const url = `${TELEGRAM_API}${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('[Telegram] Erreur:', data.description);
      return null;
    }

    return data.result;
  } catch (error) {
    console.error('[Telegram] Erreur envoi:', error.message);
    return null;
  }
}

/**
 * Formate un nombre avec signe
 */
function formatPnL(value) {
  if (value >= 0) return `+${value.toFixed(2)}`;
  return value.toFixed(2);
}

/**
 * Notification: Nouveau trade ouvert
 */
function notifyTradeOpened(botToken, chatId, trade) {
  const emoji = trade.signal === 'LONG' ? '📈' : '📉';
  const text = `
${emoji} <b>NOUVEAU TRADE</b>

<b>Paire:</b> ${trade.pairId.toUpperCase()}
<b>Signal:</b> ${trade.signal}
<b>Taille:</b> ${trade.sizeUSD} USDC
<b>Z-Score:</b> ${trade.entryZScore?.toFixed(2) || 'N/A'}

<i>${new Date().toLocaleString('fr-FR')}</i>
`.trim();

  return sendMessage(botToken, chatId, text);
}

/**
 * Notification: Trade fermé
 */
function notifyTradeClosed(botToken, chatId, trade) {
  const isProfit = trade.finalPnL >= 0;
  const emoji = isProfit ? '💰' : '💸';
  const pnlPercent = ((trade.finalPnL / trade.sizeUSD) * 100).toFixed(2);

  const text = `
${emoji} <b>TRADE FERMÉ</b>

<b>Paire:</b> ${trade.pairId.toUpperCase()}
<b>Signal:</b> ${trade.signal}
<b>PnL:</b> ${formatPnL(trade.finalPnL)} USDC (${formatPnL(parseFloat(pnlPercent))}%)
<b>Raison:</b> ${trade.exitReason}
<b>Durée:</b> ${formatDuration(trade.entryTime, trade.exitTime)}

<i>${new Date().toLocaleString('fr-FR')}</i>
`.trim();

  return sendMessage(botToken, chatId, text);
}

/**
 * Notification: Rapport de statut
 */
function notifyStatus(botToken, chatId, stats, positions) {
  const text = `
📊 <b>RAPPORT DE STATUT</b>

<b>Balance:</b> ${stats.paperBalance?.toFixed(2)} USDC
<b>Équité:</b> ${stats.paperEquity?.toFixed(2)} USDC
<b>PnL Total:</b> ${formatPnL(stats.totalPnL || 0)} USDC
<b>Win Rate:</b> ${stats.totalTrades > 0 ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(1) : 0}%
<b>Trades:</b> ${stats.totalTrades || 0} (${stats.winningTrades || 0} gagnants)
<b>Positions:</b> ${positions?.length || 0} ouvertes

<i>${new Date().toLocaleString('fr-FR')}</i>
`.trim();

  return sendMessage(botToken, chatId, text);
}

/**
 * Notification: Bot démarré
 */
function notifyBotStarted(botToken, chatId, config) {
  const text = `
🤖 <b>BOT DÉMARRÉ</b>

<b>Mode:</b> ${config.mode?.toUpperCase() || 'PAPER'}
<b>Taille position:</b> ${config.maxPositionUSD} USDC
<b>Max spreads:</b> ${config.maxConcurrentSpreads}
<b>Qualité min:</b> ${config.minQualityStars} étoiles
<b>Z-entry:</b> ±${config.zEntryThreshold}
<b>Stop loss:</b> ${config.stopLossPercent}%

<i>Le bot scanne toutes les 60s</i>
`.trim();

  return sendMessage(botToken, chatId, text);
}

/**
 * Notification: Bot arrêté
 */
function notifyBotStopped(botToken, chatId, stats) {
  const text = `
🛑 <b>BOT ARRÊTÉ</b>

<b>Session PnL:</b> ${formatPnL(stats?.totalPnL || 0)} USDC
<b>Trades:</b> ${stats?.totalTrades || 0}
<b>Win Rate:</b> ${stats?.totalTrades > 0 ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(1) : 0}%

<i>${new Date().toLocaleString('fr-FR')}</i>
`.trim();

  return sendMessage(botToken, chatId, text);
}

/**
 * Notification: Erreur
 */
function notifyError(botToken, chatId, error) {
  const text = `
⚠️ <b>ERREUR BOT</b>

${error}

<i>${new Date().toLocaleString('fr-FR')}</i>
`.trim();

  return sendMessage(botToken, chatId, text);
}

/**
 * Notification: Rapport journalier
 */
function notifyDailyReport(botToken, chatId, stats, todayTrades) {
  const todayPnL = todayTrades.reduce((sum, t) => sum + (t.finalPnL || 0), 0);
  const todayWins = todayTrades.filter(t => t.finalPnL > 0).length;

  const text = `
📅 <b>RAPPORT JOURNALIER</b>

<b>Balance:</b> ${stats.paperBalance?.toFixed(2)} USDC
<b>PnL Total:</b> ${formatPnL(stats.totalPnL || 0)} USDC

<b>Aujourd'hui:</b>
• Trades: ${todayTrades.length}
• PnL: ${formatPnL(todayPnL)} USDC
• Gagnants: ${todayWins}/${todayTrades.length}

<b>Global:</b>
• Total trades: ${stats.totalTrades}
• Win Rate: ${stats.totalTrades > 0 ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(1) : 0}%

<i>${new Date().toLocaleDateString('fr-FR')}</i>
`.trim();

  return sendMessage(botToken, chatId, text);
}

/**
 * Formate une durée entre deux timestamps
 */
function formatDuration(start, end) {
  const ms = end - start;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}j ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Teste la connexion Telegram
 */
async function testConnection(botToken, chatId) {
  const text = `
✅ <b>CONNEXION RÉUSSIE</b>

Le bot SpreadLab est maintenant connecté à ce chat.
Vous recevrez les notifications de trading ici.

<i>Test effectué le ${new Date().toLocaleString('fr-FR')}</i>
`.trim();

  const result = await sendMessage(botToken, chatId, text);
  return !!result;
}

module.exports = {
  sendMessage,
  notifyTradeOpened,
  notifyTradeClosed,
  notifyStatus,
  notifyBotStarted,
  notifyBotStopped,
  notifyError,
  notifyDailyReport,
  testConnection,
};
