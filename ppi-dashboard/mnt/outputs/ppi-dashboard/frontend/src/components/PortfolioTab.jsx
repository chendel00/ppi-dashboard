import { useEffect, useState } from "react";
import { api } from "../api";
import KPICard from "./KPICard";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#ff6600","#ff9933","#ffcc00","#00cc66","#00aaff","#cc44ff","#ff3344","#44ffcc"];
const LOGO_BASE = "https://assets.parqet.com/logos/symbol/";
const LOGO_MAP = { "EMBJ": "ERJ" };

function fmt(n, dec = 0) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(n || 0);
}

function capitalize(str) {
  if (!str) return "";
  return str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function mask(val, hidden) { return hidden ? "••••••" : val; }

function pnlColor(val) {
  if (val > 0) return "var(--green)";
  if (val < 0) return "var(--red)";
  return "var(--text-dim)";
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
    }}>{ticker.slice(0, 2)}</div>
  );
  return (
    <img src={`${LOGO_BASE}${logoTicker}`} alt={ticker}
      style={{ width: 32, height: 32, borderRadius: 4, objectFit: "contain", background: "#fff", padding: 2, flexShrink: 0 }}
      onError={() => setErr(true)} />
  );
}

function SortHeader({ label, colKey, sortKey, sortDir, onSort, align = "right" }) {
  const active = sortKey === colKey;
  return (
    <th onClick={() => onSort(colKey)} style={{
      textAlign: align, padding: "0 8px 8px", fontSize: 9, fontWeight: 700,
      letterSpacing: "0.1em", color: active ? "var(--orange)" : "var(--text-dimmer)",
      textTransform: "uppercase", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap"
    }}>
      {label} {active ? (sortDir > 0 ? "▲" : "▼") : "⇅"}
    </th>
  );
}

export default function PortfolioTab({ privacy, currency }) {
  const [data, setData]       = useState(null);
  const [mep, setMep]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [sortKey, setSortKey] = useState("market_value");
  const [sortDir, setSortDir] = useState(-1);

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
    <div style={{ textAlign: "center", marginTop: 80, color: "var(--red)", fontSize: 12 }}>ERROR: {error}</div>
  );

  const mepRate    = mep?.rate || 0;
  const isUSD      = currency === "USD";
  const totalArs   = data.total_market_value_ars;
  const totalUSD   = mepRate > 0 ? totalArs / mepRate : 0;
  const pieData    = data.positions.map(p => ({ name: p.ticker, value: p.market_value }));

  // Helpers de formato según moneda activa
  const fmtVal = (ars) => {
    if (isUSD) return mepRate > 0 ? `u$s ${fmt(ars / mepRate)}` : "—";
    return `$${fmt(ars)}`;
  };
  const fmtPnl = (pnlArs) => {
    const val = isUSD && mepRate > 0 ? pnlArs / mepRate : pnlArs;
    const prefix = isUSD ? "u$s " : "$";
    return `${val >= 0 ? "+" : ""}${prefix}${fmt(val)}`;
  };

  function handleSort(key) {
    if (key === sortKey) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(-1); }
  }

  const sortFns = {
    ticker:        (p) => p.ticker,
    quantity:      (p) => p.quantity,
    current_price: (p) => p.current_price,
    avg_cost:      (p) => p.avg_cost,
    market_value:  (p) => p.market_value,
    pnl_pct:       (p) => p.pnl_pct,
    pnl_abs:       (p) => p.pnl_ars,
    pct:           (p) => totalArs > 0 ? p.market_value / totalArs : 0,
  };

  const sortedPositions = [...data.positions].sort((a, b) => {
    const fn = sortFns[sortKey] || sortFns.market_value;
    const av = fn(a), bv = fn(b);
    if (typeof av === "string") return sortDir * av.localeCompare(bv);
    return sortDir * (bv - av);
  });

  // Totales P&L
  const totalPnlArs = data.positions.reduce((s, p) => s + p.pnl_ars, 0);
  const hasPnl = data.positions.some(p => p.avg_cost > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: hasPnl ? "repeat(5, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
        <KPICard accent label={`Valor Total ${currency}`}
          value={mask(isUSD ? `u$s ${fmt(totalUSD)}` : `$${fmt(totalArs)}`, privacy)}
          sub={isUSD ? `MEP $${fmt(mepRate)}` : "en pesos argentinos"} />
        <KPICard accent label={isUSD ? "Valor en ARS" : "Valor USD MEP"}
          value={mask(isUSD ? `$${fmt(totalArs)}` : (mepRate > 0 ? `u$s ${fmt(totalUSD)}` : "—"), privacy)}
          sub={isUSD ? "en pesos" : (mepRate > 0 ? `MEP $${fmt(mepRate)}` : "sin dato")} />
        {hasPnl && (
          <KPICard label="P&L Total"
            value={mask(fmtPnl(totalPnlArs), privacy)}
            sub="no realizado" />
        )}
        <KPICard label="Cash ARS" value={mask(`$${fmt(data.cash_ars)}`, privacy)} sub="disponible" />
        <KPICard label="Cash USD" value={mask(`u$s ${fmt(data.cash_usd, 2)}`, privacy)} sub="disponible" />
      </div>

      {/* Content grid */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12 }}>

        {/* Pie */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--orange)", marginBottom: 12, textTransform: "uppercase" }}>
            ◈ COMPOSICIÓN
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip
                formatter={(v) => [mask(fmtVal(v), privacy), "Valor"]}
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

        {/* Table */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: 16, overflowX: "auto" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--orange)", marginBottom: 12, textTransform: "uppercase" }}>
            ◈ POSICIONES <span style={{ color: "var(--text-dimmer)", fontWeight: 400 }}>— click en columna para ordenar</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--orange-border)" }}>
                <SortHeader label="TICKER"   colKey="ticker"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="left" />
                <th style={{ textAlign: "left", padding: "0 8px 8px", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-dimmer)", textTransform: "uppercase" }}>DESCRIPCIÓN</th>
                <SortHeader label="CANT"     colKey="quantity"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="PRECIO"   colKey="current_price" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                {hasPnl && <SortHeader label="COSTO" colKey="avg_cost" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                <SortHeader label={`VALOR ${currency}`} colKey="market_value" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                {hasPnl && <>
                  <SortHeader label="P&L $"  colKey="pnl_abs" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="P&L %"  colKey="pnl_pct" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </>}
                <SortHeader label="PESO" colKey="pct" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedPositions.map((p) => {
                const pct = totalArs > 0 ? ((p.market_value / totalArs) * 100).toFixed(1) : 0;
                return (
                  <tr key={p.ticker} style={{ borderBottom: "1px solid rgba(255,102,0,0.06)" }}
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
                    <td style={{ padding: "8px", textAlign: "right", color: "var(--text)" }}>
                      {mask(isUSD && mepRate > 0 ? `u$s ${fmt(p.current_price / mepRate, 2)}` : `$${fmt(p.current_price)}`, privacy)}
                    </td>
                    {hasPnl && (
                      <td style={{ padding: "8px", textAlign: "right", color: "var(--text-dim)" }}>
                        {p.avg_cost > 0 ? mask(`$${fmt(p.avg_cost)}`, privacy) : "—"}
                      </td>
                    )}
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: "var(--text)" }}>
                      {mask(fmtVal(p.market_value), privacy)}
                    </td>
                    {hasPnl && <>
                      <td style={{ padding: "8px", textAlign: "right", fontWeight: 600, color: pnlColor(p.pnl_ars) }}>
                        {p.avg_cost > 0 ? mask(fmtPnl(p.pnl_ars), privacy) : "—"}
                      </td>
                      <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: pnlColor(p.pnl_pct) }}>
                        {p.avg_cost > 0 ? `${p.pnl_pct >= 0 ? "+" : ""}${fmt(p.pnl_pct, 2)}%` : "—"}
                      </td>
                    </>}
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
