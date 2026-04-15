import { useState } from "react";
import PortfolioTab from "./components/PortfolioTab";
import BetaTab from "./components/BetaTab";
import GoalsTab from "./components/GoalsTab";

const TABS = [
  { id: "portfolio", label: "Posiciones & P&L" },
  { id: "beta", label: "Beta de cartera" },
  { id: "goals", label: "Objetivos" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("portfolio");

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">
            P
          </div>
          <span className="font-semibold text-white tracking-tight">PPI Dashboard</span>
        </div>
        <span className="text-xs text-zinc-500">
          {new Date().toLocaleDateString("es-AR", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          })}
        </span>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 px-6 pt-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="px-6 py-6 max-w-6xl mx-auto">
        {activeTab === "portfolio" && <PortfolioTab />}
        {activeTab === "beta" && <BetaTab />}
        {activeTab === "goals" && <GoalsTab />}
      </main>
    </div>
  );
}
