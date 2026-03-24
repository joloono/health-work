// Wert-Kategorie Farben (Sunset-Metapher)
export const CATEGORY_COLORS = {
  umsatz: { color: "#d4a843", gradient: "linear-gradient(135deg, #e8c25a, #d4a843)", label: "Umsatz", icon: "💰" },
  gesundheit: { color: "#6aafcf", gradient: "linear-gradient(135deg, #8ec7e0, #6aafcf)", label: "Gesundheit", icon: "🏥" },
  investition: { color: "#a8826a", gradient: "linear-gradient(135deg, #c4a08a, #a8826a)", label: "Investition", icon: "🌱" },
  oekosystem: { color: "#d48450", gradient: "linear-gradient(135deg, #e8a06a, #d48450)", label: "App-Ökosystem", icon: "🔧" },
  systeme: { color: "#908c84", gradient: "linear-gradient(135deg, #a8a49c, #908c84)", label: "Systeme", icon: "⚙️" },
};

export const VALUE_TAGS = Object.entries(CATEGORY_COLORS).map(([id, v]) => ({
  id, label: v.label, icon: v.icon, color: v.color, gradient: v.gradient,
}));

// --- Shared styles ---

export function btnStyle(bg, fg, size = "0.85rem") {
  return {
    background: bg, color: fg, border: "none", borderRadius: 8,
    padding: "0.55rem 1.4rem", fontSize: size, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
    letterSpacing: "0.01em",
  };
}

export const cardStyle = {
  background: "var(--card-bg)", borderRadius: 10, border: "1px solid var(--border)",
};

export function chipStyle(active, activeColor = "var(--accent)") {
  return {
    padding: "0.3rem 0.55rem", borderRadius: 6, fontSize: "0.65rem", fontFamily: "inherit",
    border: active ? `2px solid ${activeColor}` : "1px solid var(--border)",
    background: active ? `${activeColor}15` : "transparent",
    color: active ? activeColor : "var(--fg-dim)",
    cursor: "pointer", fontWeight: active ? 700 : 500,
    transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
    letterSpacing: "0.01em",
  };
}

export const footerBtn = {
  background: "transparent", border: "1px solid var(--border)", borderRadius: 8,
  padding: "0.5rem 0.8rem", fontSize: "0.72rem", color: "var(--fg-dim)",
  cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
};

export const inputStyle = {
  width: "100%", padding: "0.55rem 0.75rem",
  border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.82rem",
  fontFamily: "inherit", background: "var(--bg)", color: "var(--fg)",
  transition: "border-color 0.15s ease",
};

export const labelStyle = {
  fontSize: "0.6rem", color: "var(--fg-dim)", fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem",
};

export const pageStyle = (theme) => ({
  ...theme,
  fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
  maxWidth: 480, margin: "0 auto", padding: "1.2rem 1rem 2rem", color: "var(--fg)",
  minHeight: "100vh", background: "var(--bg)",
});
