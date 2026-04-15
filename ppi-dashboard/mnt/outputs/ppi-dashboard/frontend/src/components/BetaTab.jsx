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

  if (loading) return (
    <div style={{ textAlign: "center", marginTop: 80, color: "var(--orange)", fontSize: 12, letterSpacing: "0.1em" }}>
      ▶ CALCULANDO BETA...
    </div>
  );
  if (error) return (
    <div style={{ textAlign: "center", marginTop: 80, color: "var(--red)", fontSize: 12 }}>
      ERROR: {error}
    </div>
  );

  const b = data.portfolio_beta;
  const profile = b < 0.8 ? "DEFENSIVA" : b <= 1.2 ? "NEUTRAL" : "AGRESIVA";
  const profileColor = b < 0.8 ? "#00aaff" : b <= 1.2 ? "#ffcc00" : "var(--orange)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <KPICard accent label="Beta de Cartera" value={b.toFixed(3)} sub={`vs ${data.benchmark} · ${data.lookback_days}d`} />
        <div style={{ background: "var(--panel)", border: `1px solid ${profileColor}44`, borderTop: `2px solid ${profileColor}`, borderRadius: 4, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase" }}>
            PERFIL DE RIESGO
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: profileColor }}>{profile}</div>
        </div>
        <KPICard label="Posiciones" value={data.tickers.length} sub="calculadas con yfinance" />
      </div>

      {/* Bar chart */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--orange)", marginBottom: 12, textTransform: "uppercase" }}>
          ◈ BETA POR TICKER
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.tickers} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
            <XAxis dataKey="ticker" tick={{ fill: "#7a6a5a", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
            <YAxis tick={{ fill: "#7a6a5a", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
            <Tooltip
              contentStyle={{ background: "#0a1420", border: "1px solid #ff660033", borderRadius: 2, fontFamily: "IBM Plex Mono", fontSize: 11 }}
              labelStyle={{ color: "var(--orange)" }}
              formatter={(v) => [v.toFixed(4), "Beta"]}
            />
            <ReferenceLine y={1} stroke="#ff6600" strokeDasharray="4 2" label={{ value: "SPY=1", fill: "#ff6600", fontSize: 10, fontFamily: "IBM Plex Mono" }} />
            <Bar dataKey="beta" radius={[2, 2, 0, 0]}>
              {data.tickers.map((t, i) => (
                <Cell key={i} fill={t.beta >= 1.2 ? "var(--orange)" : t.beta <= 0.8 ? "#00aaff" : "#ffcc00"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: 16, overflowX: "auto" }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--orange)", marginBottom: 12, textTransform: "uppercase" }}>
          ◈ DETALLE POR TICKER
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--orange-border)" }}>
              {["TICKER", "SUBYACENTE", "PESO", "BETA", "BETA POND."].map((h, i) => (
                <th key={h} style={{
                  textAlign: i < 2 ? "left" : "right",
                  padding: "0 8px 8px", fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.1em", color: "var(--text-dimmer)", textTransform: "uppercase"
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.tickers.map((t, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(255,102,0,0.06)" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,102,0,0.04)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <td style={{ padding: "8px", color: "var(--orange)", fontWeight: 700 }}>{t.ticker}</td>
                <td style={{ padding: "8px", color: "var(--text-dim)" }}>{t.underlying || "—"}</td>
                <td style={{ padding: "8px", textAlign: "right", color: "var(--text)" }}>{(t.weight * 100).toFixed(1)}%</td>
                <td style={{ padding: "8px", textAlign: "right", color: t.beta >= 1.2 ? "var(--orange)" : t.beta <= 0.8 ? "#00aaff" : "#ffcc00", fontWeight: 600 }}>{t.beta.toFixed(3)}</td>
                <td style={{ padding: "8px", textAlign: "right", color: "var(--text)" }}>{t.weighted_beta.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 10, color: "var(--text-dimmer)", marginTop: 12 }}>{data.note}</div>
      </div>
    </div>
  );
}
