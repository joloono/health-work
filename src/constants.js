// Wert-Kategorie Farben (Sunset-Metapher)
export const CATEGORY_COLORS = {
  umsatz: { color: "#f5c842", gradient: "linear-gradient(135deg, #ffde59, #f5c842)", label: "Umsatz", icon: "💰" },
  gesundheit: { color: "#7ec4e8", gradient: "linear-gradient(135deg, #a6d9f7, #7ec4e8)", label: "Gesundheit", icon: "🏥" },
  investition: { color: "#b88a70", gradient: "linear-gradient(135deg, #d2a58c, #b88a70)", label: "Investition", icon: "🌱" },
  oekosystem: { color: "#e8945a", gradient: "linear-gradient(135deg, #ffb278, #e8945a)", label: "App-Ökosystem", icon: "🔧" },
  systeme: { color: "#a09c92", gradient: "linear-gradient(135deg, #bebab0, #a09c92)", label: "Systeme", icon: "⚙️" },
};

export const VALUE_TAGS = Object.entries(CATEGORY_COLORS).map(([id, v]) => ({
  id, label: v.label, icon: v.icon, color: v.color, gradient: v.gradient,
}));

// --- Shared styles ---

export function btnStyle(bg, fg, size = "0.88rem") {
  return {
    background: bg, color: fg, border: "none", borderRadius: 8,
    padding: "0.5rem 1.4rem", fontSize: size, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  };
}

export const cardStyle = {
  background: "var(--card-bg)", borderRadius: 8, border: "1px solid var(--border)",
};

export function chipStyle(active, activeColor = "var(--accent)") {
  return {
    padding: "0.25rem 0.5rem", borderRadius: 5, fontSize: "0.65rem", fontFamily: "inherit",
    border: active ? `2px solid ${activeColor}` : "1px solid var(--border)",
    background: active ? `${activeColor}18` : "transparent",
    color: active ? activeColor : "var(--fg-dim)",
    cursor: "pointer", fontWeight: active ? 700 : 400,
    transition: "all 0.15s ease",
  };
}

export const footerBtn = {
  background: "transparent", border: "1px solid var(--border)", borderRadius: 8,
  padding: "0.5rem 0.8rem", fontSize: "0.72rem", color: "var(--fg-dim)",
  cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
};

export const inputStyle = {
  width: "100%", padding: "0.5rem 0.7rem",
  border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.82rem",
  fontFamily: "inherit", background: "var(--bg)", color: "var(--fg)",
};

export const labelStyle = {
  fontSize: "0.65rem", color: "var(--fg-dim)", fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem",
};

export const pageStyle = (theme) => ({
  ...theme,
  fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
  maxWidth: 480, margin: "0 auto", padding: "1.5rem 1rem", color: "var(--fg)",
  minHeight: "100vh", background: "var(--bg)",
});
