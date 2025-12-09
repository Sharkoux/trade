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
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, annotationPlugin);

export default function PairChart({ pairId, coinA, coinB, series, zEnter = 1.5, zExit = 0.5 }) {
  const labels = (series || []).map((p) =>
    new Date(p.t).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
  );
  const dataRatios = (series || []).map((p) => p.ratio);

  const [tokenA, tokenB] = (pairId || `${coinA}-${coinB}`).toUpperCase().split('-');

  // Utiliser mean/std du dernier point (fenêtre glissante 90j calculée côté API)
  const lastPoint = series && series.length > 0 ? series[series.length - 1] : null;
  const mean = lastPoint?.mean || 0;
  const std = lastPoint?.std || 0;

  const chartData = {
    labels,
    datasets: [
      {
        label: `Ratio ${tokenA}/${tokenB}`,
        data: dataRatios,
        borderColor: '#38bdf8',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
      annotation: {
        annotations: {
          meanLine: {
            type: 'line',
            yMin: mean,
            yMax: mean,
            borderColor: '#94a3b8',
            borderWidth: 1,
            borderDash: [5, 5],
            label: {
              display: true,
              content: 'Moyenne',
              position: 'start',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              font: { size: 10 },
            },
          },
          upperEntry: {
            type: 'line',
            yMin: mean + zEnter * std,
            yMax: mean + zEnter * std,
            borderColor: '#ef4444',
            borderWidth: 1,
            borderDash: [3, 3],
            label: {
              display: true,
              content: `SHORT (z=${zEnter})`,
              position: 'start',
              backgroundColor: 'transparent',
              color: '#ef4444',
              font: { size: 9 },
            },
          },
          lowerEntry: {
            type: 'line',
            yMin: mean - zEnter * std,
            yMax: mean - zEnter * std,
            borderColor: '#22c55e',
            borderWidth: 1,
            borderDash: [3, 3],
            label: {
              display: true,
              content: `LONG (z=-${zEnter})`,
              position: 'start',
              backgroundColor: 'transparent',
              color: '#22c55e',
              font: { size: 9 },
            },
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af', maxTicksLimit: 8 },
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

  return (
    <div className="h-72 md:h-96">
      {series && series.length > 1 ? (
        <Line data={chartData} options={chartOptions} />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-500 text-sm">
          Pas encore assez de données pour tracer le graphique…
        </div>
      )}
    </div>
  );
}
