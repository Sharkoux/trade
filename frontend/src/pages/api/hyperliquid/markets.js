// pages/api/hyperliquid/markets.js
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method not allowed');

  const q = (req.query.q || '').toString().toLowerCase();

  try {
    const hlRes = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta' }), // perps meta
    });

    if (!hlRes.ok) {
      return res.status(502).json({ error: 'Hyperliquid meta error' });
    }

    const meta = await hlRes.json();
    // La doc meta renvoie en général meta.universe (liste des coins perps) 
    const coins = meta.universe || meta.coins || [];

    const list = coins
      .map((c) => (typeof c === 'string' ? c : c.name || c.coin || null))
      .filter(Boolean)
      .filter((name) => name.toLowerCase().includes(q))
      .sort();

    // on dédoublonne
    const unique = [...new Set(list)];

    res.status(200).json({ coins: unique });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
}
