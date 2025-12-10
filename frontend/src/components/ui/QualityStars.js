export default function QualityStars({ stars, showLabel = false, size = 'md' }) {
  const maxStars = 5;
  const filledStars = Math.min(Math.max(0, stars), maxStars);

  const sizeClasses = {
    sm: 'text-xs gap-0.5',
    md: 'text-sm gap-0.5',
    lg: 'text-base gap-1',
  };

  const getColor = () => {
    if (filledStars >= 4) return 'text-green-400';
    if (filledStars >= 2) return 'text-yellow-400';
    return 'text-gray-500';
  };

  return (
    <div className={`flex items-center ${sizeClasses[size]}`}>
      {filledStars >= 4 && (
        <span className="mr-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-green-500 text-white rounded">
          TOP
        </span>
      )}
      <span className={getColor()}>
        {'★'.repeat(filledStars)}
      </span>
      <span className="text-gray-700">
        {'★'.repeat(maxStars - filledStars)}
      </span>
      {showLabel && (
        <span className="ml-1 text-gray-500 text-xs">
          {filledStars}/5
        </span>
      )}
    </div>
  );
}
