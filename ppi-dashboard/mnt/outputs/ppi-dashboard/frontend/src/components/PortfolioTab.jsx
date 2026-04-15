import { useEffect, useState } from "react";
import { api } from "../api";
import KPICard from "./KPICard";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#6366f1","#22d3ee","#f59e0b","#10b981","#f43f5e",
  "#a78bfa","#34d399","#fb923c","#38bdf8","#e879f9",
];

function fmt(n, dec = 0) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n);
}

function fmtPct(n) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function PortfolioTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.portfolio()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-zinc-400 text-center mt-20">Cargando cartera…</p>;
  if (error) return <p className="text-red-400 text-center mt-20">Error: {error}</p>;

  const pieData = data.positions.map((p) => ({
    name: p.ticker,
    value: p.market_value,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Valor total"
          value={`$${fmt(data.total_market_value)}`}
          sub="ARS"
        />
        <KPICard
          label="P&L no realizado"
          value={fmtPct(data.total_unrealised_pnl_pct)}
          sub={`$${fmt(data.total_unrealised_pnl)}`}
          positive={data.total_unrealised_pnl >= 0}
        />
        <KPICard
          label="Cash ARS"
          value={`$${fmt(data.cash_ars)}`}
        />
        <KPICard
          label="Cash USD"
          value={`u$s ${fmt(data.cash_usd, 2)}`}
        />
      </div>

      {/* Pie + table */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="bg-zinc-800 rounded-2xl p-5 shadow">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Composición</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => [`$${fmt(v)}`, "Valor"]}
                contentStyle={{ background: "#27272a", border: "none", borderRadius: 8 }}
                labelStyle={{ color: "#d4d4d8" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Positions table */}
        <div className="bg-zinc-800 rounded-2xl p-5 shadow overflow-x-auto">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Posiciones</h2>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-700">
                <th className="pb-2 pr-3">Ticker</th>
                <th className="pb-2 pr-3 text-right">Valor</th>
                <th className="pb-2 text-right">P&L %</th>
              </tr>
            </thead>
            <tbody>
              {data.positions.map((p, i) => (
                <tr key={i} className="border-b border-zinc-700/50 hover:bg-zinc-700/30 transition">
                  <td className="py-2 pr-3 font-medium text-white">{p.ticker}</td>
                  <td className="py-2 pr-3 text-right text-zinc-300">${fmt(p.market_value)}</td>
                  <td
                    className={`py-2 text-right font-semibold ${
                      p.unrealised_pnl_pct >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {fmtPct(p.unrealised_pnl_pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
