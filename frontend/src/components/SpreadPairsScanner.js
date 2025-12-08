// components/SpreadPairsScanner.js
import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';

// Univers pensés pour le spread trading sur Hyperliquid
// (tokens choisis parmi ceux que tu as dans ton allMids)
const SPREAD_UNIVERSES = [
  {
    id: 'l2',
    label: 'Layer 2 (OP / ARB / MNT / STRK / ZK)',
    coins: ['OP', 'ARB', 'MNT', 'STRK', 'ZK'],
  },
  {
    id: 'lsd',
    label: 'Liquid Staking (LDO / ETHFI / PENDLE / RPL?)',
    coins: ['LDO', 'ETHFI', 'PENDLE'],
  },
  {
    id: 'dex',
    label: 'DEX Tokens (UNI / SUSHI / GMX / APEX)',
    coins: ['UNI', 'SUSHI', 'GMX', 'APEX'],
  },
  {
    id: 'bluechips',
    label: 'Bluechips (BTC / ETH / SOL / AVAX)',
    coins: ['BTC', 'ETH', 'SOL', 'AVAX'],
  },
];

function generatePairs(list) {
  const pairs = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      pairs.push({ a: list[i], b: list[j] });
    }
  }
  return pairs;
}

export default function SpreadPairsScanner() {
  const [universeId, setUniverseId] = useState('l2');
  const router = useRouter();

  const universe = useMemo(
    () => SPREAD_UNIVERSES.find((u) => u.id === universeId) || SPREAD_UNIVERSES[0],
    [universeId]
  );

  const pairs = useMemo(() => generatePairs(universe.coins), [universe]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">🧮 Scanner de paires pour spread trading</h2>
        <select
          value={universeId}
          onChange={(e) => setUniverseId(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs md:text-sm outline-none focus:border-sky-500"
        >
          {SPREAD_UNIVERSES.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-slate-400">
        Ces paires sont générées à partir d&apos;univers cohérents (L2 entre eux, DEX entre eux,
        etc.) pour faciliter les stratégies de ratio / mean reversion.
      </p>

      <div className="overflow-x-auto text-xs md:text-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left py-2">Paire</th>
              <th className="text-left py-2">Stratégie</th>
              <th className="text-left py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => {
              const pairId = `${p.a}-${p.b}`.toLowerCase();
              return (
                <tr key={pairId} className="border-b border-slate-900/60">
                  <td className="py-2 font-medium">
                    {p.a} / {p.b}
                  </td>
                  <td className="py-2 text-slate-400">
                    Spread {universe.label.split('(')[0].trim()}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/pairs/${pairId}`)}
                      className="inline-flex items-center text-[11px] md:text-xs px-3 py-1.5 rounded-md border border-slate-700 hover:bg-slate-800"
                    >
                      Ouvrir la fiche
                    </button>
                  </td>
                </tr>
              );
            })}
            {pairs.length === 0 && (
              <tr>
                <td colSpan={3} className="py-3 text-slate-500 text-center">
                  Aucune paire disponible dans cet univers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-500">
        ➜ Plus tard, tu pourras brancher ici un score auto (z-score moyen, corrélation, volume,
        funding...) pour trier & mettre en avant les meilleures opportunités.
      </p>
    </div>
  );
}
