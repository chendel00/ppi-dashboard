import { useEffect, useState } from "react";
import { api } from "../api";
import KPICard from "./KPICard";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#ff6600","#ff9933","#ffcc00","#00cc66","#00aaff","#cc44ff","#ff3344","#44ffcc"];
const LOGO_BASE = "https://assets.parqet.com/logos/symbol/";

// Mapa de tickers cuyo logo debe buscarse con un símbolo diferente
const LOGO_MAP = {
  "EMBJ": "ERJ",   // Embraer cotiza como ERJ en NYSE
};

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

function numColor(val) {
  if (val < 0) return "var(--red)";
  return "var(--text)";
}

function TickerLogo({ ticker }) {
  const [err, setErr] = useState(false);
  const logoTicker = LOGO_MAP[ticker] || ticker;

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
      src={`${LOGO_BASE}${logoTicker}`}
      alt={ticker}
      style={{ width: 32, height: 32, borderRadius: 4, objectFit: "contain", background: "#fff", padding: 2, flexShrink: 0 }}
      onError={() => setErr(true)}
    />
  );
}

const SORT_KEYS = {
  ticker: (p) => p.ticker,
  quantity: (p) => p.quantity,
  current_price: (p) => p.current_price,
  market_value: (p) => p.market_value,
  usd: (p, mepRate) => mepRate > 0 ? p.market_value / mepRate : 0,
  pct: (p, _, total) => total > 0 ? p.market_value / total : 0,
};

function SortHeader({ label, colKey, sortKey, sortDir, onSort, align = "right" }) {
  const active = sortKey === colKey;
  return (
    <th
      onClick={() => onSort(colKey)}
      style={{
        textAlign: align, padding: "0 8px 8px", fontSize: 9, fontWeight: 700,
        letterSpacing: "0.1em", color: active ? "var(--orange)" : "var(--text-dimmer)",
        textTransform: "uppercase", cursor: "pointer", userSelect: "none",
        whiteSpace: "nowrap"
      }}
    >
      {label} {active ? (sortDir > 0 ? "▲" : "▼") : "⇅"}
    </th>
  );
}

export default function PortfolioTab({ privacy }) {
  const [data, setData] = useState(null);
  const [mep, setMep] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState("market_value");
  const [sortDir, setSortDir] = useState(-1); // -1 = descendente

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
  const totalArs = data.total_market_value_ars;
  const pieData = data.positions.map(p => ({ name: p.ticker, value: p.market_value }));

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir(d => d * -1);
    } else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  const sortedPositions = [...data.positions].sort((a, b) => {
    const fn = SORT_KEYS[sortKey] || SORT_KEYS.market_value;
    const av = fn(a, mepRate, totalArs);
    const bv = fn(b, mepRate, totalArs);
    if (typeof av === "string") return sortDir * av.localeCompare(bv);
    return sortDir * (bv - av);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPICard accent label="Valor Total ARS" value={mask(`$${fmt(totalArs)}`, privacy)} sub="en pesos argentinos" />
        <KPICard accent label="Valor USD MEP" value={mask(`u$s ${fmt(totalUSD)}`, privacy)} sub={mepRate > 0 ? `MEP $${fmt(mepRate)}` : "sin dato MEP"} />
        <KPICard label="Cash ARS" value={mask(`$${fmt(data.cash_ars)}`, privacy)} sub="disponible" />
        <KPICard label="Cash USD" value={mask(`u$s ${fmt(data.cash_usd, 2)}`, privacy)} sub="disponible" />
      </div>

      {/* Content grid */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12 }}>

        {/* Pie chart */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--orange)", marginBottom: 12, textTransform: "uppercase" }}>
            ◈ COMPOSICIÓN
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip
                formatter={(v) => [mask(`$${fmt(v)}`, privacy), "Valor"]}
                contentStyle={{ background: "#0a1420", border: "1px solid #ff660033", borderRadius: 2, fontFamily: "IBM Plex Mono", fontSize: 11 }}
                labelStyle={{ color: "var(--orange)" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
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
            ◈ POSICIONES <span style={{ color: "var(--text-dimmer)", fontWeight: 400 }}>— click en columna para ordenar</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--orange-border)" }}>
                <SortHeader label="TICKER"   colKey="ticker"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="left" />
                <th style={{ textAlign: "left", padding: "0 8px 8px", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-dimmer)", textTransform: "uppercase" }}>DESCRIPCIÓN</th>
                <SortHeader label="CANT"     colKey="quantity"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="PRECIO"   colKey="current_price"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="VALOR ARS" colKey="market_value"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="VALOR USD" colKey="usd"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="%"         colKey="pct"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedPositions.map((p, i) => {
                const pct = totalArs > 0 ? ((p.market_value / totalArs) * 100).toFixed(1) : 0;
                const usdVal = mepRate > 0 ? p.market_value / mepRate : 0;
                return (
                  <tr key={p.ticker} style={{ borderBottom: "1px solid rgba(255,102,0,0.06)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,102,0,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "8px", display: "flex", alignItems: "center", gap: 8 }}>
                      <TickerLogo ticker={p.ticker} />
                      <span style={{ color: "var(--orange)", fontWeight: 700 }}>{p.ticker}</span>
                    </td>
                    <td style={{ padding: "8px", color: "var(--text-dim)", fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {capitalize(p.description)}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", color: "var(--text-dim)" }}>{fmt(p.quantity)}</td>
                    <td style={{ padding: "8px", textAlign: "right", color: numColor(p.current_price), fontWeight: p.current_price < 0 ? 600 : 400 }}>
                      {mask(`$${fmt(p.current_price)}`, privacy)}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: numColor(p.market_value) }}>
                      {mask(`$${fmt(p.market_value)}`, privacy)}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", color: mepRate > 0 ? numColor(usdVal) : "var(--text-dimmer)" }}>
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
