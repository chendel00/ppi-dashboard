import { useEffect, useState } from "react";
import { api } from "../api";
import KPICard from "./KPICard";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";

export default function BetaTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.beta().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center mt-32"><div className="text-zinc-400 animate-pulse">Calculando beta…</div></div>;
  if (error) return <p className="text-red-400 text-center mt-20">Error: {error}</p>;

  const betaLabel = data.portfolio_beta < 0.8 ? "Defensiva" : data.portfolio_beta <= 1.2 ? "Neutral" : "Agresiva";
  const betaColor = data.portfolio_beta < 0.8 ? "text-sky-400" : data.portfolio_beta <= 1.2 ? "text-yellow-400" : "text-orange-400";
  const betaIcon = data.portfolio_beta < 0.8 ? "🛡️" : data.portfolio_beta <= 1.2 ? "⚖️" : "🔥";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KPICard icon="📊" label="Beta de Cartera" value={data.portfolio_beta.toFixed(3)} sub={`vs ${data.benchmark} · ${data.lookback_days}d`} />
        <KPICard icon={betaIcon} label="Perfil de Riesgo" value={betaLabel} />
        <KPICard icon="🎯" label="Posiciones" value={data.tickers.length} sub="calculadas con yfinance" />
      </div>

      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl p-5 shadow-lg">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">Beta por Ticker</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.tickers} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
            <XAxis dataKey="ticker" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
            <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 10 }}
              labelStyle={{ color: "#d4d4d8" }}
              formatter={(v, name) => [v.toFixed(4), name === "beta" ? "Beta" : "Beta pond."]}
            />
            <ReferenceLine y={1} stroke="#6366f1" strokeDasharray="4 2" label={{ value: "SPY=1", fill: "#6366f1", fontSize: 11 }} />
            <Bar dataKey="beta" radius={[6, 6, 0, 0]}>
              {data.tickers.map((t, i) => (
                <Cell key={i} fill={t.beta >= 1.2 ? "#f97316" : t.beta <= 0.8 ? "#38bdf8" : "#6366f1"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl p-5 shadow-lg overflow-x-auto">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">Detalle por Ticker</h2>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-700">
              <th className="pb-2 pr-4">Ticker</th>
              <th className="pb-2 pr-4">Subyacente</th>
              <th className="pb-2 pr-4 text-right">Peso</th>
              <th className="pb-2 pr-4 text-right">Beta</th>
              <th className="pb-2 text-right">Beta Pond.</th>
            </tr>
          </thead>
          <tbody>
            {data.tickers.map((t, i) => (
              <tr key={i} className="border-b border-zinc-700/50 hover:bg-zinc-700/30 transition">
                <td className="py-2 pr-4 font-semibold text-white">{t.ticker}</td>
                <td className="py-2 pr-4 text-zinc-400">{t.underlying}</td>
                <td className="py-2 pr-4 text-right text-zinc-300">{(t.weight * 100).toFixed(1)}%</td>
                <td className="py-2 pr-4 text-right text-zinc-300">{t.beta.toFixed(3)}</td>
                <td className="py-2 text-right text-indigo-300 font-medium">{t.weighted_beta.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-zinc-600 mt-3">{data.note}</p>
      </div>
    </div>
  );
}
