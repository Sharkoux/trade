// components/PairChart.js
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

function computeStats(series) {
  if (!series || series.length === 0) return null;
  const values = series.map((p) => p.ratio);
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance =
    values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / Math.max(1, n - 1);
  const std = Math.sqrt(variance);
  const last = values[n - 1];
  const z = std > 0 ? (last - mean) / std : 0;
  return { mean, std, last, z };
}

export default function PairChart({ pairId, coinA, coinB, series }) {
  const stats = computeStats(series);
  const labels = (series || []).map((p) =>
    new Date(p.t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );
  const dataRatios = (series || []).map((p) => p.ratio);

  const [tokenA, tokenB] = (pairId || `${coinA}-${coinB}`).toUpperCase().split('-');

  const chartData = {
    labels,
    datasets: [
      {
        label: `${tokenA}/${tokenB}`,
        data: dataRatios,
        borderColor: '#38bdf8',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af', maxTicksLimit: 6 },
        grid: { color: '#1f2937' },
      },
      y: {
        ticks: {
          color: '#9ca3af',
          callback: (v) => (typeof v === 'number' ? v.toFixed(3) : v),
        },
        grid: { color: '#1f2937' },
      },
    },
  };

  let suggestion = null;
  if (stats) {
    if (stats.z > 1) {
      suggestion = {
        type: 'shortA_longB',
        text: `Ratio haut (${stats.z.toFixed(
          2
        )}σ au dessus de la moyenne) → envisager short ${tokenA} / long ${tokenB} (mean reversion).`,
      };
    } else if (stats.z < -1) {
      suggestion = {
        type: 'longA_shortB',
        text: `Ratio bas (${stats.z.toFixed(
          2
        )}σ sous la moyenne) → envisager long ${tokenA} / short ${tokenB}.`,
      };
    } else {
      suggestion = {
        type: 'neutral',
        text: `Ratio proche de sa moyenne (z = ${stats.z.toFixed(
          2
        )}) → pas de signal fort, attendre un écart plus marqué.`,
      };
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stats header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs md:text-sm">
        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
          <div className="text-slate-400">Ratio actuel</div>
          <div className="text-slate-50 text-lg font-semibold">
            {stats ? stats.last.toFixed(4) : '…'}
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
          <div className="text-slate-400">Moyenne</div>
          <div className="text-slate-50 text-lg font-semibold">
            {stats ? stats.mean.toFixed(4) : '…'}
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
          <div className="text-slate-400">Écart-type</div>
          <div className="text-slate-50 text-lg font-semibold">
            {stats ? stats.std.toFixed(4) : '…'}
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
          <div className="text-slate-400">Z-score</div>
          <div className="text-slate-50 text-lg font-semibold">
            {stats ? stats.z.toFixed(2) : '…'}
          </div>
        </div>
      </div>

      {/* Suggestion d’entrée */}
      {suggestion && (
        <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-xs md:text-sm text-slate-200">
          <div className="text-slate-400 mb-1">Suggestion de zone d&apos;entrée (indicative) :</div>
          <div>{suggestion.text}</div>
        </div>
      )}

      {/* Chart */}
      <div className="h-64 md:h-80 bg-slate-900/60 border border-slate-800 rounded-xl p-3 md:p-4">
        {series && series.length > 1 ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500 text-sm">
            Pas encore assez de données pour tracer le graphique…
          </div>
        )}
      </div>
    </div>
  );
}
