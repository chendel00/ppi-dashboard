import { useState } from "react";
import PortfolioTab from "./components/PortfolioTab";
import BetaTab from "./components/BetaTab";
import GoalsTab from "./components/GoalsTab";
import HistoryTab from "./components/HistoryTab";

const TABS = [
  { id: "portfolio", label: "POSICIONES" },
  { id: "history",   label: "HISTORIAL" },
  { id: "beta",      label: "BETA" },
  { id: "goals",     label: "OBJETIVOS" },
];

const now = new Date();
const dateStr = now.toLocaleDateString("es-AR", {
  day: "2-digit", month: "short", year: "numeric"
}).toUpperCase();
const timeStr = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

const TICKERS_DEMO = [
  "COIN", "SPY", "SMH", "GLD", "URA", "NVDA", "EMBJ"
];

export default function App() {
  const [activeTab, setActiveTab] = useState("portfolio");
  const [privacy, setPrivacy] = useState(false);

  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh", fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* Top bar */}
      <div style={{
        background: "var(--orange)", color: "#000",
        height: 30, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 16px",
        fontSize: 11, fontWeight: 700, letterSpacing: "0.08em"
      }}>
        <span>▶ PPI TERMINAL · PORTFOLIO PERSONAL INVERSIONES</span>
        <div style={{ display: "flex", gap: 24 }}>
          <span>{dateStr} · {timeStr}</span>
          <span>CUENTA: ***694</span>
        </div>
      </div>

      {/* Ticker tape */}
      <div style={{
        background: "#070f1a", borderBottom: "1px solid var(--orange-border)",
        height: 26, overflow: "hidden", display: "flex", alignItems: "center"
      }}>
        <div className="ticker-track" style={{ display: "flex", gap: 0, whiteSpace: "nowrap" }}>
          {[...TICKERS_DEMO, ...TICKERS_DEMO].map((t, i) => (
            <span key={i} style={{
              padding: "0 20px", fontSize: 11, letterSpacing: "0.06em",
              borderRight: "1px solid var(--orange-dim)",
              color: i % 3 === 0 ? "var(--green)" : "var(--text-dim)"
            }}>
              <span style={{ color: "var(--orange)", fontWeight: 700, marginRight: 6 }}>{t}</span>
              {i % 3 === 0 ? "▲" : "▼"}{(Math.random() * 3).toFixed(2)}%
            </span>
          ))}
        </div>
      </div>

      {/* Nav tabs */}
      <nav style={{
        display: "flex", gap: 0, padding: "0 16px",
        background: "var(--panel)", borderBottom: "1px solid var(--orange-border)",
        alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 20px", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.1em", cursor: "pointer", border: "none",
                background: "transparent", fontFamily: "inherit",
                color: activeTab === tab.id ? "var(--orange)" : "var(--text-dim)",
                borderBottom: activeTab === tab.id ? "2px solid var(--orange)" : "2px solid transparent",
                marginBottom: -1, transition: "all 0.1s"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Privacy toggle */}
        <button
          onClick={() => setPrivacy(p => !p)}
          title={privacy ? "Mostrar valores" : "Ocultar valores"}
          style={{
            background: privacy ? "var(--orange-dim)" : "transparent",
            border: `1px solid ${privacy ? "var(--orange)" : "var(--orange-border)"}`,
            borderRadius: 4, padding: "4px 12px", cursor: "pointer",
            fontFamily: "inherit", fontSize: 11, fontWeight: 700,
            color: privacy ? "var(--orange)" : "var(--text-dim)",
            letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6,
            transition: "all 0.15s"
          }}
        >
          {privacy ? "👁 OCULTO" : "👁 OCULTAR $"}
        </button>
      </nav>

      {/* Main content */}
      <main style={{ padding: "20px 16px 60px", maxWidth: 1280, margin: "0 auto" }}>
        {activeTab === "portfolio" && <PortfolioTab privacy={privacy} />}
        {activeTab === "history"   && <HistoryTab   privacy={privacy} />}
        {activeTab === "beta"      && <BetaTab />}
        {activeTab === "goals"     && <GoalsTab      privacy={privacy} />}
      </main>

      {/* Status bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--orange)", color: "#000",
        height: 22, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 16px",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", zIndex: 50
      }}>
        <span>● CONECTADO · PPI API</span>
        <span>{privacy ? "🔒 MODO PRIVADO ACTIVO" : "DATOS EN TIEMPO REAL"}</span>
        <span>v2.0 · BLOOMBERG STYLE</span>
      </div>
    </div>
  );
}
