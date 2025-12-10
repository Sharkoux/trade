export default function ScoreBar({ score, showValue = true }) {
  const normalizedScore = Math.min(Math.max(0, score), 100);

  const getColor = () => {
    if (normalizedScore >= 80) return 'bg-green-500';
    if (normalizedScore >= 60) return 'bg-blue-500';
    if (normalizedScore >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTextColor = () => {
    if (normalizedScore >= 80) return 'text-green-400';
    if (normalizedScore >= 60) return 'text-blue-400';
    if (normalizedScore >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="flex items-center gap-2">
      {showValue && (
        <span className={`text-sm font-bold min-w-[2rem] ${getTextColor()}`}>
          {Math.round(normalizedScore)}
        </span>
      )}
      <div className="flex-1 h-1.5 bg-[#1f1f23] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${normalizedScore}%` }}
        />
      </div>
    </div>
  );
}
