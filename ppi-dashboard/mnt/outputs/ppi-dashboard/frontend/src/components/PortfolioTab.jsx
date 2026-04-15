import { useEffect, useState } from "react";
import { api } from "../api";
import KPICard from "./KPICard";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#6366f1","#22d3ee","#f59e0b","#10b981","#f43f5e","#a78bfa","#34d399","#fb923c","#38bdf8","#e879f9"];

const LOGO_BASE = "https://assets.parqet.com/logos/symbol/";

function fmt(n, dec = 0) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n || 0);
}

function capitalize(str) {
  if (!str) return "";
  return str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function TickerLogo({ ticker }) {
  const [err, setErr] = useState(false);
  if (err) return (
    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
      {ticker.slice(0, 2)}
    </div>
  );
  return (
    <img
      src={`${LOGO_BASE}${ticker}`}
      alt={ticker}
      className="w-8 h-8 rounded-full object-contain bg-white p-0.5 shrink-0"
      onError={() => setErr(true)}
    />
  );
}

export default function PortfolioTab() {
  const [data, setData] = useState(null);
  const [mep, setMep] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.portfolio(), api.mep()])
      .then(([port, mepData]) => { setData(port); setMep(mepData); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center mt-32"><div className="text-zinc-400 animate-pulse">Cargando cartera…</div></div>;
  if (error) return <p className="text-red-400 text-center mt-20">Error: {error}</p>;

  const totalUSD = mep?.rate > 0 ? data.total_market_value_ars / mep.rate : 0;
  const pieData = data.positions.map(p => ({ name: p.ticker, value: p.market_value }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon="💼" label="Valor Total" value={`$${fmt(data.total_market_value_ars)}`} sub="en pesos" />
        <KPICard icon="💵" label="Valor en USD MEP" value={mep?.rate > 0 ? `u$s ${fmt(totalUSD, 0)}` : "—"} sub={mep?.rate > 0 ? `MEP $${fmt(mep.rate)}` : "sin dato"} />
        <KPICard icon="🏦" label="Cash ARS" value={`$${fmt(data.cash_ars)}`} />
        <KPICard icon="💴" label="Cash USD" value={`u$s ${fmt(data.cash_usd, 2)}`} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl p-5 shadow-lg">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">Composición</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => [`$${fmt(v)}`, "Valor"]} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 10 }} labelStyle={{ color: "#d4d4d8" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl p-5 shadow-lg overflow-x-auto">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">Posiciones</h2>
          <div className="space-y-2">
            {data.positions.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-700/40 transition">
                <TickerLogo ticker={p.ticker} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{p.ticker}</span>
                    <span className="text-xs text-zinc-500 truncate">{capitalize(p.description)}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{fmt(p.quantity)} u · ${fmt(p.current_price)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-white text-sm">${fmt(p.market_value)}</div>
                  {mep?.rate > 0 && <div className="text-xs text-zinc-500">u$s {fmt(p.market_value / mep.rate, 0)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
