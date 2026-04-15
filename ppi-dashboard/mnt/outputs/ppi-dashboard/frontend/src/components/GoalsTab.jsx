import { useEffect, useState } from "react";
import { api } from "../api";

function fmt(n, dec = 0) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(n || 0);
}

function mask(val, hidden) {
  return hidden ? "••••••" : val;
}

function ProgressBar({ pct }) {
  const clamped = Math.min(pct, 100);
  const color = clamped >= 80 ? "#00cc66" : clamped >= 40 ? "#ffcc00" : "var(--orange)";
  return (
    <div style={{ width: "100%", background: "#1a2030", borderRadius: 2, height: 4, marginTop: 8 }}>
      <div style={{ width: `${clamped}%`, height: 4, borderRadius: 2, background: color, transition: "width 0.7s" }} />
    </div>
  );
}

export default function GoalsTab({ privacy }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.goals().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: "center", marginTop: 80, color: "var(--orange)", fontSize: 12, letterSpacing: "0.1em" }}>
      ▶ CARGANDO OBJETIVOS...
    </div>
  );
  if (error) return (
    <div style={{ textAlign: "center", marginTop: 80, color: "var(--red)", fontSize: 12 }}>
      ERROR: {error}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase" }}>TOTAL ARS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--orange)" }}>{mask(`$${fmt(data.total_portfolio_value_ars)}`, privacy)}</div>
        </div>
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase" }}>TOTAL USD</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{mask(`u$s ${fmt(data.total_portfolio_value_usd, 2)}`, privacy)}</div>
        </div>
      </div>

      {/* Goals */}
      {data.goals.length === 0 ? (
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>
          <div>SIN OBJETIVOS DEFINIDOS</div>
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dimmer)" }}>
            Editá <code style={{ color: "var(--orange)" }}>goals.json</code> en el backend para agregarlos.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {data.goals.map((g) => {
            const color = g.progress_pct >= 80 ? "#00cc66" : g.progress_pct >= 40 ? "#ffcc00" : "var(--orange)";
            const current = g.currency === "USD"
              ? `u$s ${fmt(g.current_amount, 2)}`
              : `$${fmt(g.current_amount)}`;
            const target = g.currency === "USD"
              ? `u$s ${fmt(g.target_amount, 2)}`
              : `$${fmt(g.target_amount)}`;
            return (
              <div key={g.id} style={{ background: "var(--panel)", border: `1px solid var(--orange-border)`, borderTop: `2px solid ${color}`, borderRadius: 4, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 13 }}>{g.name}</div>
                    {g.description && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>{g.description}</div>}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 2,
                    background: g.on_track ? "rgba(0,204,102,0.1)" : "rgba(255,102,0,0.1)",
                    color: g.on_track ? "#00cc66" : "var(--orange)",
                    border: `1px solid ${g.on_track ? "#00cc6644" : "var(--orange-border)"}`,
                    letterSpacing: "0.06em"
                  }}>
                    {g.on_track ? "EN CAMINO" : "REVISAR"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color, fontWeight: 700 }}>{mask(current, privacy)}</span>
                  <span style={{ color: "var(--text-dim)" }}>META: {mask(target, privacy)}</span>
                </div>

                <ProgressBar pct={g.progress_pct} />

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-dimmer)", marginTop: 8 }}>
                  <span>{g.progress_pct.toFixed(1)}% COMPLETADO</span>
                  {g.deadline && (
                    <span>LÍMITE: {new Date(g.deadline).toLocaleDateString("es-AR", { year: "numeric", month: "short" }).toUpperCase()}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
