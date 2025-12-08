import { useEffect, useState } from 'react';

export default function PairChart({ pairId = 'op-arb' }) {
  const [ratios, setRatios] = useState([]);
  const [labels, setLabels] = useState([]);
  const [error, setError] = useState(null);

  const tokenA = pairId.split('-')[0].toUpperCase(); // 'OP'
  const tokenB = pairId.split('-')[1].toUpperCase(); // 'ARB'

  useEffect(() => {
    const fetchLivePrices = async () => {
      const res = await fetch('https://api.hyperliquid.xyz/info', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'allMids' }),
});

if (!res.ok) {
  throw new Error('API Hyperliquid inaccessible');
}

const data = await res.json();

// Extraction des prix directement depuis l’objet clé-valeur
const priceA = parseFloat(data[tokenA]);
const priceB = parseFloat(data[tokenB]);

if (isNaN(priceA) || isNaN(priceB)) {
  setError(`Token introuvable ou prix invalide : ${tokenA} ou ${tokenB}`);
  return;
}
    

const ratio = priceA / priceB;
setRatios((prev) => [...prev.slice(-49), ratio.toFixed(4)]);
setLabels((prev) => [...prev.slice(-49), new Date().toLocaleTimeString()]);

    };

    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 30000); // every 30 seconds
    return () => clearInterval(interval);
  }, [pairId]);

  return (
    <div>
      <h2>Ratio en direct : {ratios.length > 0 ? ratios[ratios.length - 1] : 'Chargement...'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {/* insérer ici le graphique react-chartjs-2 */}
    </div>
  );
}
