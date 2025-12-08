// components/PairSearch.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function PairSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [tokenA, setTokenA] = useState(null);
  const [tokenB, setTokenB] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/hyperliquid/markets?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!cancelled) setResults(data.coins || []);
      } catch (e) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const id = setTimeout(run, 300); // debounce
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const canCreatePair = tokenA && tokenB && tokenA !== tokenB;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-5">
      <h2 className="text-lg font-semibold mb-3">🔎 Recherche de paire Hyperliquid</h2>

      <div className="flex flex-col md:flex-row gap-3 mb-3">
        <input
          type="text"
          placeholder="Tape un nom de token (OP, ARB, LDO, ...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        {loading && <span className="text-xs text-slate-400">Recherche…</span>}
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
          {results.slice(0, 16).map((name) => {
            const isA = tokenA === name;
            const isB = tokenB === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  if (!tokenA) setTokenA(name);
                  else if (!tokenB && name !== tokenA) setTokenB(name);
                  else if (name === tokenA) setTokenA(null);
                  else if (name === tokenB) setTokenB(null);
                }}
                className={[
                  'px-2 py-1 rounded border',
                  isA
                    ? 'bg-emerald-500 border-emerald-400 text-slate-900'
                    : isB
                    ? 'bg-purple-500 border-purple-400 text-slate-900'
                    : 'bg-slate-950 border-slate-700 text-slate-200 hover:bg-slate-800',
                ].join(' ')}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 text-xs text-slate-300">
        <div>
          <span className="text-slate-400">Token A :</span>{' '}
          <span className="font-semibold">{tokenA || '—'}</span>
        </div>
        <div>
          <span className="text-slate-400">Token B :</span>{' '}
          <span className="font-semibold">{tokenB || '—'}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={!canCreatePair}
        onClick={() => {
          if (!canCreatePair) return;
          const pairId = `${tokenA}-${tokenB}`.toLowerCase();
          router.push(`/pairs/${pairId}`);
        }}
        className={[
          'mt-4 w-full text-sm font-semibold py-2 rounded-md',
          canCreatePair
            ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed',
        ].join(' ')}
      >
        Ouvrir la page de détail de la paire
      </button>
    </div>
  );
}
