export default function KPICard({ label, value, sub, accent = false }) {
  return (
    <div style={{
      background: "var(--panel)", border: "1px solid var(--orange-border)",
      borderRadius: 4, padding: "14px 16px",
      borderTop: accent ? "2px solid var(--orange)" : "1px solid var(--orange-border)"
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 6
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 20, fontWeight: 700, color: accent ? "var(--orange)" : "var(--text)",
        letterSpacing: "-0.5px"
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "var(--text-dimmer)", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
