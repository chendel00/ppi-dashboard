export default function KPICard({ label, value, sub, positive, icon }) {
  const colorClass =
    positive === undefined ? "text-white"
    : positive ? "text-emerald-400"
    : "text-red-400";

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl p-5 flex flex-col gap-1 shadow-lg">
      <div className="flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-xs uppercase tracking-widest text-zinc-400 font-medium">{label}</span>
      </div>
      <span className={`text-2xl font-bold tracking-tight ${colorClass}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-500 mt-0.5">{sub}</span>}
    </div>
  );
}
