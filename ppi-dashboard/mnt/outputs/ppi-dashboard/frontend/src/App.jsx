import { useState } from "react";
import PortfolioTab from "./components/PortfolioTab";
import BetaTab from "./components/BetaTab";
import GoalsTab from "./components/GoalsTab";
import HistoryTab from "./components/HistoryTab";

const TABS = [
  { id: "portfolio", label: "Posiciones & P&L", icon: "📈" },
  { id: "history",   label: "Historial",         icon: "📋" },
  { id: "beta",      label: "Beta de Cartera",   icon: "⚖️" },
  { id: "goals",     label: "Objetivos",          icon: "🎯" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("portfolio");

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between bg-zinc-900/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold shadow-lg">
            P
          </div>
          <div>
            <span className="font-bold text-white tracking-tight">PPI Dashboard</span>
            <span className="text-zinc-500 text-xs ml-2">Portfolio Personal</span>
          </div>
        </div>
        <span className="text-xs text-zinc-500 hidden md:block">
          {new Date().toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 px-6 pt-5 border-b border-zinc-800 bg-zinc-900">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-indigo-500 text-white bg-zinc-800/60"
                : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/40"
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="px-6 py-6 max-w-7xl mx-auto">
        {activeTab === "portfolio" && <PortfolioTab />}
        {activeTab === "history"   && <HistoryTab />}
        {activeTab === "beta"      && <BetaTab />}
        {activeTab === "goals"     && <GoalsTab />}
      </main>
    </div>
  );
}
