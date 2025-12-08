// pages/spread.js
import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

export default function SpreadTradeProPage() {
  const [ratios, setRatios] = useState([]);
  const [labels, setLabels] = useState([]);
  const [entryRatio, setEntryRatio] = useState(1.35);
  const [exitRatio, setExitRatio] = useState(1.20);
  const [startDate, setStartDate] = useState("2023-11-01");
  const [endDate, setEndDate] = useState("2023-12-01");
  const [capital, setCapital] = useState(100);
  const [profit, setProfit] = useState(null);
  const [trades, setTrades] = useState([]);
  const [estimatedFees, setEstimatedFees] = useState(0);

  useEffect(() => {
    const fetchMockData = () => {
      const days = 30;
      const mock = Array.from({ length: days }, (_, i) => {
        const op = 1.2 + Math.random() * 0.4;
        const arb = 1.0 + Math.random() * 0.3;
        return {
          date: `Jour ${i + 1}`,
          op,
          arb,
          ratio: op / arb,
        };
      });

      const ratioList = mock.map((d) => d.ratio);
      const timeLabels = mock.map((d) => d.date);
      setRatios(ratioList);
      setLabels(timeLabels);

      const entryIndex = ratioList.findIndex((r) => r >= entryRatio);
      const exitIndex = ratioList.findIndex((r, i) => i > entryIndex && r <= exitRatio);

      if (entryIndex !== -1 && exitIndex !== -1) {
        const entry = mock[entryIndex];
        const exit = mock[exitIndex];
        const gain = (entry.ratio - exit.ratio) / entry.ratio;
        const grossProfit = gain * capital;
        const fees = capital * 0.0002 * 2; // 0.02% x2 legs

        setProfit((grossProfit - fees).toFixed(2));
        setEstimatedFees(fees.toFixed(2));
        setTrades([{ entry, exit, gain: gain.toFixed(4) }]);
      }
    };

    fetchMockData();
  }, [entryRatio, exitRatio, startDate, endDate, capital]);

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: 'auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 'bold', textAlign: 'center' }}>OP / ARB Spread Strategy</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
        <div>
          <label>💸 Capital engagé (€)</label>
          <input
            type="number"
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value))}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label>📅 Période</label><br/>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: 6, marginRight: 8 }}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: 6 }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 24 }}>
        <div>
          <label>🟢 Entrée si Ratio ≥</label>
          <input
            type="number"
            step="0.01"
            value={entryRatio}
            onChange={(e) => setEntryRatio(Number(e.target.value))}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label>🔴 Sortie si Ratio ≤</label>
          <input
            type="number"
            step="0.01"
            value={exitRatio}
            onChange={(e) => setExitRatio(Number(e.target.value))}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <p style={{ fontSize: 18, marginBottom: 4 }}>💰 Profit estimé : <strong>{profit !== null ? `${profit} €` : "..."}</strong></p>
          <p style={{ fontSize: 14, color: 'gray' }}>(frais estimés : {estimatedFees} €)</p>
        </div>
      </div>

      <div style={{ marginTop: 32, border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>📈 Historique Ratio OP/ARB</h2>
        <Line
          data={{
            labels: labels,
            datasets: [
              {
                label: 'OP / ARB',
                data: ratios,
                borderColor: '#3b82f6',
                fill: false,
              },
            ],
          }}
        />
      </div>

      {trades.length > 0 && (
        <div style={{ marginTop: 24, border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>📋 Détail du trade</h2>
          <ul>
            <li>📍 Entrée : {trades[0].entry.date} (Ratio : {trades[0].entry.ratio.toFixed(4)})</li>
            <li>🚪 Sortie : {trades[0].exit.date} (Ratio : {trades[0].exit.ratio.toFixed(4)})</li>
            <li>📊 Gain brut : {trades[0].gain * 100}%</li>
          </ul>
        </div>
      )}
    </div>
  );
}
