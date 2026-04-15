import { useEffect, useState } from "react";
import { api } from "../api";

function ProgressBar({ pct }) {
  const clamped = Math.min(pct, 100);
  const color =
    clamped >= 80 ? "bg-emerald-500" : clamped >= 40 ? "bg-yellow-500" : "bg-indigo-500";
  return (
    <div className="w-full bg-zinc-700 rounded-full h-2 mt-2">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function fmt(n, dec = 0) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n);
}

export default function GoalsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.goals()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-zinc-400 text-center mt-20">Cargando objetivos…</p>;
  if (error) return <p className="text-red-400 text-center mt-20">Error: {error}</p>;

  return (
    <div className="space-y-6">
      {/* Portfolio summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-800 rounded-2xl p-5 shadow">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Total ARS</p>
          <p className="text-2xl font-bold text-white">${fmt(data.total_portfolio_value_ars)}</p>
        </div>
        <div className="bg-zinc-800 rounded-2xl p-5 shadow">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Total USD</p>
          <p className="text-2xl font-bold text-white">u$s {fmt(data.total_portfolio_value_usd, 2)}</p>
        </div>
      </div>

      {/* Goals list */}
      {data.goals.length === 0 ? (
        <div className="bg-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
          <p className="text-lg">No hay objetivos definidos.</p>
          <p className="text-sm mt-1">Edita <code className="text-indigo-400">goals.json</code> en el backend para agregarlos.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {data.goals.map((g) => (
            <div key={g.id} className="bg-zinc-800 rounded-2xl p-5 shadow space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-white">{g.name}</h3>
                  {g.description && (
                    <p className="text-xs text-zinc-500 mt-0.5">{g.description}</p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    g.on_track
                      ? "bg-emerald-900/60 text-emerald-400"
                      : "bg-zinc-700 text-zinc-400"
                  }`}
                >
                  {g.on_track ? "En camino" : "Revisar"}
                </span>
              </div>

              <div className="flex items-end justify-between text-sm">
                <span className="text-zinc-300">
                  {g.currency === "USD"
                    ? `u$s ${fmt(g.current_amount, 2)}`
                    : `$${fmt(g.current_amount)}`}
                </span>
                <span className="text-zinc-500">
                  meta:{" "}
                  {g.currency === "USD"
                    ? `u$s ${fmt(g.target_amount, 2)}`
                    : `$${fmt(g.target_amount)}`}
                </span>
              </div>

              <ProgressBar pct={g.progress_pct} />

              <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
                <span>{g.progress_pct.toFixed(1)}% completado</span>
                {g.deadline && (
                  <span>
                    Fecha límite:{" "}
                    {new Date(g.deadline).toLocaleDateString("es-AR", {
                      year: "numeric", month: "short",
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
