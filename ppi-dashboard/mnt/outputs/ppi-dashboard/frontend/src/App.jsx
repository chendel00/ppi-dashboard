import { useState, useEffect } from "react";
import PortfolioTab from "./components/PortfolioTab";
import BetaTab from "./components/BetaTab";
import { api } from "./api";

const TABS = [
  { id: "portfolio", label: "POSICIONES" },
  { id: "beta",      label: "BETA DE CARTERA" },
];

const now = new Date();
const dateStr = now.toLocaleDateString("es-AR", {
  day: "2-digit", month: "short", year: "numeric"
}).toUpperCase();
const timeStr = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

// Fallback estático por si YF está bloqueado desde el server
const TICKERS_FALLBACK = [
  { ticker: "COIN",  change_pct: +2.41 },
  { ticker: "SPY",   change_pct: +0.83 },
  { ticker: "SMH",   change_pct: -1.22 },
  { ticker: "GLD",   change_pct: +0.31 },
  { ticker: "URA",   change_pct: -0.54 },
  { ticker: "NVDA",  change_pct: -2.46 },
  { ticker: "ERJ",   change_pct: +2.92 },
];

function NavBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 20px", fontSize: 11, fontWeight: 700,
      letterSpacing: "0.1em", cursor: "pointer", border: "none",
      background: "transparent", fontFamily: "inherit",
      color: active ? "var(--orange)" : "var(--text-dim)",
      borderBottom: active ? "2px solid var(--orange)" : "2px solid transparent",
      marginBottom: -1, transition: "all 0.1s"
    }}>
      {children}
    </button>
  );
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "var(--orange-dim)" : "transparent",
      border: `1px solid ${active ? "var(--orange)" : "var(--orange-border)"}`,
      borderRadius: 4, padding: "4px 12px", cursor: "pointer",
      fontFamily: "inherit", fontSize: 11, fontWeight: 700,
      color: active ? "var(--orange)" : "var(--text-dim)",
      letterSpacing: "0.06em", transition: "all 0.15s"
    }}>
      {children}
    </button>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("portfolio");
  const [privacy, setPrivacy]     = useState(false);
  const [currency, setCurrency]   = useState("ARS"); // "ARS" | "USD"
  const [tapeItems, setTapeItems] = useState(TICKERS_FALLBACK);

  useEffect(() => {
    api.tape()
      .then(items => { if (items && items.length > 0) setTapeItems(items); })
      .catch(() => {}); // silently keep fallback
  }, []);

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
        <div className="ticker-track" style={{ display: "flex", whiteSpace: "nowrap" }}>
          {[...tapeItems, ...tapeItems].map((item, i) => (
            <span key={i} style={{
              padding: "0 20px", fontSize: 11, letterSpacing: "0.06em",
              borderRight: "1px solid var(--orange-dim)",
              display: "inline-flex", alignItems: "center", gap: 4
            }}>
              <span style={{ color: "var(--orange)", fontWeight: 700 }}>{item.ticker}</span>
              {item.price != null && (
                <span style={{ color: "var(--text-dim)", fontSize: 10 }}>{item.price.toFixed(2)}</span>
              )}
              <span style={{ color: item.change_pct >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                {item.change_pct >= 0 ? "▲" : "▼"}{Math.abs(item.change_pct).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav style={{
        display: "flex", padding: "0 16px",
        background: "var(--panel)", borderBottom: "1px solid var(--orange-border)",
        alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex" }}>
          {TABS.map(tab => (
            <NavBtn key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </NavBtn>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Currency toggle */}
          <div style={{ display: "flex", border: "1px solid var(--orange-border)", borderRadius: 4, overflow: "hidden" }}>
            <button onClick={() => setCurrency("ARS")} style={{
              padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", letterSpacing: "0.06em", border: "none",
              background: currency === "ARS" ? "var(--orange)" : "transparent",
              color: currency === "ARS" ? "#000" : "var(--text-dim)",
              transition: "all 0.15s"
            }}>ARS</button>
            <button onClick={() => setCurrency("USD")} style={{
              padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", letterSpacing: "0.06em", border: "none",
              borderLeft: "1px solid var(--orange-border)",
              background: currency === "USD" ? "var(--orange)" : "transparent",
              color: currency === "USD" ? "#000" : "var(--text-dim)",
              transition: "all 0.15s"
            }}>USD</button>
          </div>

          {/* Privacy toggle */}
          <ToggleBtn active={privacy} onClick={() => setPrivacy(p => !p)}>
            {privacy ? "👁 OCULTO" : "👁 OCULTAR $"}
          </ToggleBtn>
        </div>
      </nav>

      {/* Content */}
      <main style={{ padding: "20px 16px 60px", maxWidth: 1400, margin: "0 auto" }}>
        {activeTab === "portfolio" && <PortfolioTab privacy={privacy} currency={currency} />}
        {activeTab === "beta"      && <BetaTab />}
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
        <span>{privacy ? "🔒 MODO PRIVADO" : ""}{currency === "USD" ? "  💵 VISTA USD" : ""}</span>
        <span>v2.1</span>
      </div>
    </div>
  );
}
