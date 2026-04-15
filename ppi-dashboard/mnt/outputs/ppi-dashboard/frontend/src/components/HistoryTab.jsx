import { useEffect, useState } from "react";
import { api } from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function fmt(n, dec = 0) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n || 0);
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export default function HistoryTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.history().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center mt-32"><div className="text-zinc-400 animate-pulse">Cargando movimientos…</div></div>;
  if (error) return <p className="text-red-400 text-center mt-20">Error: {error}</p>;

  const movements = data.movements || [];

  // Agrupar por mes para el gráfico
  const byMonth = {};
  movements.forEach(m => {
    const month = (m.date || "").slice(0, 7);
    if (!month) return;
    if (!byMonth[month]) byMonth[month] = 0;
    byMonth[month] += m.amount;
  });
  const chartData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));

  const totalIngreso = movements.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const totalEgreso = movements.filter(m => m.amount < 0).reduce((s, m) => s + m.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl p-5 shadow-lg">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Movimientos</p>
          <p className="text-2xl font-bold text-white">{movements.length}</p>
          <p className="text-xs text-zinc-500">últimos 12 meses</p>
        </div>
        <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl p-5 shadow-lg">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Total Ingresos</p>
          <p className="text-2xl font-bold text-emerald-400">${fmt(totalIngreso)}</p>
        </div>
        <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl p-5 shadow-lg">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Total Egresos</p>
          <p className="text-2xl font-bold text-red-400">${fmt(Math.abs(totalEgreso))}</p>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl p-5 shadow-lg">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">Flujo Mensual</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 10 }}
                formatter={(v) => [`$${fmt(v)}`, "Monto"]}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.amount >= 0 ? "#10b981" : "#f43f5e"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl p-5 shadow-lg overflow-x-auto">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">Últimos Movimientos</h2>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-700">
              <th className="pb-2 pr-4">Fecha</th>
              <th className="pb-2 pr-4">Descripción</th>
              <th className="pb-2 pr-2">Moneda</th>
              <th className="pb-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {movements.slice(0, 50).map((m, i) => (
              <tr key={i} className="border-b border-zinc-700/50 hover:bg-zinc-700/30 transition">
                <td className="py-2 pr-4 text-zinc-400 text-xs">{m.date?.slice(0, 10)}</td>
                <td className="py-2 pr-4 text-zinc-300">{capitalize(m.description)}</td>
                <td className="py-2 pr-2 text-zinc-500 text-xs">{m.currency}</td>
                <td className={`py-2 text-right font-medium ${m.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {m.amount >= 0 ? "+" : ""}${fmt(m.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
