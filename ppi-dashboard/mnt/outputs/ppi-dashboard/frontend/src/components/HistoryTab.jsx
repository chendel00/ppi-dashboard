import { useEffect, useState } from "react";
import { api } from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function fmt(n, dec = 0) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(n || 0);
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function mask(val, hidden) {
  return hidden ? "••••••" : val;
}

export default function HistoryTab({ privacy }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.history().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: "center", marginTop: 80, color: "var(--orange)", fontSize: 12, letterSpacing: "0.1em" }}>
      ▶ CARGANDO MOVIMIENTOS...
    </div>
  );
  if (error) return (
    <div style={{ textAlign: "center", marginTop: 80, color: "var(--red)", fontSize: 12 }}>
      ERROR: {error}
    </div>
  );

  const movements = data.movements || [];

  const byMonth = {};
  movements.forEach(m => {
    const month = (m.date || "").slice(0, 7);
    if (!month) return;
    byMonth[month] = (byMonth[month] || 0) + m.amount;
  });
  const chartData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));

  const totalIngreso = movements.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const totalEgreso = movements.filter(m => m.amount < 0).reduce((s, m) => s + m.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase" }}>MOVIMIENTOS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--orange)" }}>{movements.length}</div>
          <div style={{ fontSize: 10, color: "var(--text-dimmer)", marginTop: 4 }}>últimos 12 meses</div>
        </div>
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase" }}>TOTAL INGRESOS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>{mask(`$${fmt(totalIngreso)}`, privacy)}</div>
        </div>
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase" }}>TOTAL EGRESOS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--red)" }}>{mask(`$${fmt(Math.abs(totalEgreso))}`, privacy)}</div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--orange)", marginBottom: 12, textTransform: "uppercase" }}>
            ◈ FLUJO MENSUAL
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={{ fill: "#7a6a5a", fontSize: 10, fontFamily: "IBM Plex Mono" }} />
              <YAxis tick={{ fill: "#7a6a5a", fontSize: 10, fontFamily: "IBM Plex Mono" }} />
              <Tooltip
                contentStyle={{ background: "#0a1420", border: "1px solid #ff660033", borderRadius: 2, fontFamily: "IBM Plex Mono", fontSize: 11 }}
                labelStyle={{ color: "var(--orange)" }}
                formatter={(v) => [mask(`$${fmt(v)}`, privacy), "Monto"]}
              />
              <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.amount >= 0 ? "#00cc66" : "#ff3344"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Movements table */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--orange-border)", borderRadius: 4, padding: 16, overflowX: "auto" }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--orange)", marginBottom: 12, textTransform: "uppercase" }}>
          ◈ ÚLTIMOS MOVIMIENTOS
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--orange-border)" }}>
              {["FECHA", "DESCRIPCIÓN", "MONEDA", "MONTO"].map((h, i) => (
                <th key={h} style={{
                  textAlign: i < 3 ? "left" : "right",
                  padding: "0 8px 8px", fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.1em", color: "var(--text-dimmer)", textTransform: "uppercase"
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movements.slice(0, 50).map((m, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(255,102,0,0.06)" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,102,0,0.04)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <td style={{ padding: "7px 8px", color: "var(--text-dim)", fontSize: 11 }}>{m.date?.slice(0, 10)}</td>
                <td style={{ padding: "7px 8px", color: "var(--text)" }}>{capitalize(m.description)}</td>
                <td style={{ padding: "7px 8px", color: "var(--text-dimmer)", fontSize: 11 }}>{m.currency}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: m.amount >= 0 ? "var(--green)" : "var(--red)" }}>
                  {mask(`${m.amount >= 0 ? "+" : ""}$${fmt(m.amount)}`, privacy)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
