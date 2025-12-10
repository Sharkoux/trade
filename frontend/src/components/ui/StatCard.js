export default function StatCard({ title, value, subtitle, trend, icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
    green: 'from-green-500/10 to-green-600/5 border-green-500/20',
    red: 'from-red-500/10 to-red-600/5 border-red-500/20',
    yellow: 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
  };

  const textColors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${colorClasses[color]} p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${textColors[color]}`}>{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-lg bg-[#1f1f23] flex items-center justify-center ${textColors[color]}`}>
            {icon}
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`mt-2 text-xs ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? '+' : ''}{trend}% vs hier
        </div>
      )}
    </div>
  );
}
