export default function SignalBadge({ signal, size = 'md' }) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const colorClasses = {
    SHORT: 'bg-red-500/20 text-red-400 border-red-500/30',
    LONG: 'bg-green-500/20 text-green-400 border-green-500/30',
    NEUTRE: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  return (
    <span className={`inline-flex items-center font-semibold rounded border ${sizeClasses[size]} ${colorClasses[signal] || colorClasses.NEUTRE}`}>
      {signal}
    </span>
  );
}
