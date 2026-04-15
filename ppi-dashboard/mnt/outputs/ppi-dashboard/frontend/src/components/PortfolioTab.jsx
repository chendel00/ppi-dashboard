import { useEffect, useState } from "react";
import { api } from "../api";
import KPICard from "./KPICard";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#ff6600","#ff9933","#ffcc00","#00cc66","#00aaff","#cc44ff","#ff3344","#44ffcc"];
const LOGO_BASE = "https://assets.parqet.com/logos/symbol/";

function fmt(n, dec = 0) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n || 0);
}

function capitalize(str) {
  if (!str) return "";
  return str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function mask(val, hidden) {
  return hidden ? "••••••" : val;
}

function TickerLogo({ ticker }) {
  const [err, setErr] = useState(false);
  if (err) return (
    <div style={{
      width: 32, height: 32, borderRadius: 4, background: "#1a2030",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 700, color: "var(--orange)",
      border: "1px solid var(--orange-border)", flexShrink: 0
    }}>
      {ticker.slice(0, 2)}
    </div>
  );
  return (
    <img
      src={`${LOGO_BASE}${ticker}`}
      alt={ticker}
      style={{ width: 32, height: 32, borderRadius: 4, objectFit: "contain", background: "#fff", padding: 2, flexShrink: 0 }}
      onError={() => setErr(true)}
    />
  );
}

export default function PortfolioTab({ privacy }) {
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

  if (loading) return (
    <div style={{ textAlign: "center", marginTop: 80, color: "var(--orange)", fontSize: 12, letterSpacing: "0.1em" }}>
      ▶ CARGANDO CARTERA...
    </div>
  );
  if (error) return (
    <div style={{ textAlign: "center", marginTop: 80, color: "var(--red)", fontSize: 12 }}>
      ERROR: {error}
    </div>
  );

  const mepRate = mep?.rate || 0;
  const totalUSD = mepRate > 0 ? data.total_market_value_ars / mepRate : 0;
  const pieData = data.positions.map(p => ({ name: p.ticker, value: p.market_value }));

  // total for % calculation
  const totalArs = data.total_market_value_ars;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPICard accent label="Valor Total ARS" value={mask(`$${fmt(data.total_market_value_ars)}`, privacy)} sub="en pesos argentinos" />
        <KPICard accent label="Valor USD MEP" value={mask(`u$s ${fmt(totalUSD)}`, privacy)} sub={mepRate > 0 ? `MEP $${fmt(mepRate)}` : "sin dato MEP"} />
        <KPICard label="Cash ARS" value={mask(`$${fmt(data.cash_ars)}`, privacy)} sub="disponible" />
        <KPICard label="Cash USD" value={mask(`u$s ${fmt(data.cash_usd, 2)}`, privacy)} sub="disponible" />
      </div>

      {/* Content grid */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 12 }}>

        {/* Pie chart */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--orange)", marginBottom: 12, textTransform: "uppercase" }}>
            ◈ COMPOSICIÓN
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip
                formatter={(v) => [mask(`$${fmt(v)}`, privacy), "Valor"]}
                contentStyle={{ background: "#0a1420", border: "1px solid #ff660033", borderRadius: 2, fontFamily: "IBM Plex Mono", fontSize: 11 }}
                labelStyle={{ color: "var(--orange)" }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
            {data.positions.map((p, i) => {
              const pct = totalArs > 0 ? ((p.market_value / totalArs) * 100).toFixed(1) : 0;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ color: "var(--orange)", fontWeight: 700, width: 48 }}>{p.ticker}</span>
                  <span style={{ color: "var(--text-dim)" }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Positions table */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: 16, overflowX: "auto" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--orange)", marginBottom: 12, textTransform: "uppercase" }}>
            ◈ POSICIONES
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--orange-border)" }}>
                {["TICKER", "DESCRIPCIÓN", "CANT", "PRECIO", "VALOR ARS", "VALOR USD", "%"].map(h => (
                  <th key={h} style={{
                    textAlign: h === "TICKER" || h === "DESCRIPCIÓN" ? "left" : "right",
                    padding: "0 8px 8px", fontSize: 9, fontWeight: 700,
                    letterSpacing: "0.1em", color: "var(--text-dimmer)", textTransform: "uppercase"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.positions.map((p, i) => {
                const pct = totalArs > 0 ? ((p.market_value / totalArs) * 100).toFixed(1) : 0;
                const usdVal = mepRate > 0 ? p.market_value / mepRate : 0;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,102,0,0.06)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,102,0,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "8px", display: "flex", alignItems: "center", gap: 8 }}>
                      <TickerLogo ticker={p.ticker} />
                      <span style={{ color: "var(--orange)", fontWeight: 700 }}>{p.ticker}</span>
                    </td>
                    <td style={{ padding: "8px", color: "var(--text-dim)", fontSize: 11, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {capitalize(p.description)}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", color: "var(--text-dim)" }}>{fmt(p.quantity)}</td>
                    <td style={{ padding: "8px", textAlign: "right", color: "var(--text)" }}>{mask(`$${fmt(p.current_price)}`, privacy)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: "var(--text)" }}>{mask(`$${fmt(p.market_value)}`, privacy)}</td>
                    <td style={{ padding: "8px", textAlign: "right", color: "var(--text-dim)" }}>
                      {mepRate > 0 ? mask(`u$s ${fmt(usdVal)}`, privacy) : "—"}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", color: "var(--orange)", fontWeight: 600 }}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
