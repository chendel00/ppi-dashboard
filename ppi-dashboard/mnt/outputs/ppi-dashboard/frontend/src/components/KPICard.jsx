export default function KPICard({ label, value, sub, positive }) {
  const colorClass =
    positive === undefined
      ? "text-white"
      : positive
      ? "text-emerald-400"
      : "text-red-400";

  return (
    <div className="bg-zinc-800 rounded-2xl p-5 flex flex-col gap-1 shadow">
      <span className="text-xs uppercase tracking-widest text-zinc-400">{label}</span>
      <span className={`text-2xl font-bold ${colorClass}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
}
