import { useState, useEffect } from "react";
import { api } from "./api.js";
import { btnStyle, inputStyle, pageStyle } from "./constants.js";

// Icon suggestions by keyword — matched against category name
const ICON_SUGGESTIONS = [
  { keywords: ["umsatz", "revenue", "geld", "sales", "verkauf", "einnahm"], icons: ["💰", "💵", "🤑", "📈", "🏦"] },
  { keywords: ["gesundheit", "health", "körper", "fitness", "sport", "bewegung"], icons: ["🏥", "💪", "🏃", "❤️", "🧘"] },
  { keywords: ["invest", "langfrist", "bildung", "lernen", "wissen", "buch"], icons: ["🌱", "📚", "🎓", "🧠", "🔬"] },
  { keywords: ["app", "ökosystem", "produkt", "tool", "software", "code"], icons: ["🔧", "⚡", "🛠️", "💻", "🚀"] },
  { keywords: ["system", "infra", "automat", "prozess", "setup", "ops"], icons: ["⚙️", "🔩", "🏗️", "📋", "🤖"] },
  { keywords: ["marketing", "content", "social", "brand", "werbung"], icons: ["📣", "📱", "🎯", "✍️", "📢"] },
  { keywords: ["kunde", "client", "beratung", "consult", "service"], icons: ["🤝", "👥", "💼", "🎩", "📞"] },
  { keywords: ["kreativ", "design", "kunst", "visual", "foto"], icons: ["🎨", "✨", "🖌️", "📸", "🎬"] },
  { keywords: ["admin", "büro", "office", "email", "orga"], icons: ["📧", "🗂️", "📎", "🏢", "📝"] },
  { keywords: ["reise", "travel", "netzwerk", "event", "meet"], icons: ["✈️", "🌍", "🎪", "🍽️", "🏔️"] },
];

// Color auto-assigned per icon "vibe"
const ICON_COLOR_MAP = {
  "💰": "#f5c842", "💵": "#f5c842", "🤑": "#f5c842", "📈": "#e8945a", "🏦": "#b88a70",
  "🏥": "#7ec4e8", "💪": "#e85a5a", "🏃": "#5ae89a", "❤️": "#e85a8a", "🧘": "#7ec4e8",
  "🌱": "#5aaa5a", "📚": "#b88a70", "🎓": "#7c6bc4", "🧠": "#e85a8a", "🔬": "#5a9ee8",
  "🔧": "#e8945a", "⚡": "#f5c842", "🛠️": "#a09c92", "💻": "#5a9ee8", "🚀": "#c44d2b",
  "⚙️": "#a09c92", "🔩": "#888", "🏗️": "#b88a70", "📋": "#7ec4e8", "🤖": "#7c6bc4",
  "📣": "#e85a8a", "📱": "#5a9ee8", "🎯": "#c44d2b", "✍️": "#b88a70", "📢": "#e8945a",
  "🤝": "#2d8a4e", "👥": "#5a9ee8", "💼": "#b88a70", "🎩": "#333", "📞": "#2d8a4e",
  "🎨": "#e85a8a", "✨": "#f5c842", "🖌️": "#7c6bc4", "📸": "#5a9ee8", "🎬": "#c44d2b",
  "📧": "#5a9ee8", "🗂️": "#a09c92", "📎": "#888", "🏢": "#a09c92", "📝": "#e8945a",
  "✈️": "#5a9ee8", "🌍": "#2d8a4e", "🎪": "#e85a8a", "🍽️": "#e8945a", "🏔️": "#7ec4e8",
};

const PRESET_COLORS = ["#f5c842", "#7ec4e8", "#b88a70", "#e8945a", "#a09c92", "#c44d2b", "#2d8a4e", "#7c6bc4", "#e85a8a", "#5a9ee8"];

function suggestIcons(name) {
  if (!name) return ["💡", "🏷️", "📌", "🔖", "⭐"];
  const lower = name.toLowerCase();
  for (const group of ICON_SUGGESTIONS) {
    if (group.keywords.some((kw) => lower.includes(kw))) return group.icons;
  }
  return ["💡", "🏷️", "📌", "🔖", "⭐"];
}

function colorForIcon(icon) {
  return ICON_COLOR_MAP[icon] || null;
}

function IconPicker({ value, onChange, name }) {
  const suggestions = suggestIcons(name);
  return (
    <div>
      <div style={{ fontSize: "0.6rem", color: "var(--fg-dim)", fontWeight: 600, marginBottom: "0.2rem" }}>Icon wählen</div>
      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
        {suggestions.map((emoji) => (
          <button key={emoji} onClick={() => onChange(emoji)} style={{
            width: 34, height: 34, borderRadius: 8, fontSize: "1.1rem",
            border: value === emoji ? "2px solid var(--accent)" : "1px solid var(--border)",
            background: value === emoji ? "rgba(196,77,43,0.1)" : "var(--card-bg)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {emoji}
          </button>
        ))}
        <input value={suggestions.includes(value) ? "" : value} onChange={(e) => onChange(e.target.value)}
          placeholder="…" style={{ ...inputStyle, width: 34, height: 34, textAlign: "center", fontSize: "1rem", padding: 0 }} />
      </div>
    </div>
  );
}

function CategoryCard({ cat, onSave, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(cat.label);
  const [icon, setIcon] = useState(cat.icon);
  const [color, setColor] = useState(cat.color);
  const [desc, setDesc] = useState(cat.description || "");

  const handleIconChange = (newIcon) => {
    setIcon(newIcon);
    const autoColor = colorForIcon(newIcon);
    if (autoColor) setColor(autoColor);
  };

  const handleSave = async () => {
    await onSave(cat.id, { slug: cat.slug, label, icon, color, description: desc, active: cat.active, sort_order: cat.sort_order });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.8rem",
        background: "var(--card-bg)", borderRadius: 8, opacity: cat.active ? 1 : 0.5,
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
          {cat.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{cat.label}</div>
          {cat.description && <div style={{ fontSize: "0.6rem", color: "var(--fg-dim)" }}>{cat.description}</div>}
        </div>
        <button onClick={() => setEditing(true)} style={{ ...btnStyle("transparent", "var(--fg-dim)", "0.65rem"), border: "1px solid var(--border)", padding: "0.2rem 0.5rem" }}>
          Bearbeiten
        </button>
        <button onClick={() => onToggle(cat.id, !cat.active)} style={{
          ...btnStyle("transparent", cat.active ? "var(--fg-dim)" : "var(--done)", "0.65rem"),
          border: "1px solid var(--border)", padding: "0.2rem 0.5rem",
        }}>
          {cat.active ? "Aus" : "Ein"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "0.8rem", background: "var(--card-bg)", borderRadius: 8, border: "2px solid var(--accent)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name" style={inputStyle} />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Beschreibung (optional)" style={{ ...inputStyle, fontSize: "0.75rem" }} />
        <IconPicker value={icon} onChange={handleIconChange} name={label} />
        <div>
          <div style={{ fontSize: "0.6rem", color: "var(--fg-dim)", fontWeight: 600, marginBottom: "0.2rem" }}>Farbe</div>
          <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", alignItems: "center" }}>
            {PRESET_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 22, height: 22, borderRadius: "50%", background: c,
                border: color === c ? "3px solid var(--fg)" : "2px solid transparent", cursor: "pointer",
              }} />
            ))}
            <span style={{ fontSize: "0.55rem", color: "var(--fg-dim)", marginLeft: "0.3rem" }}>
              {color === colorForIcon(icon) ? "auto" : ""}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end" }}>
          <button onClick={() => setEditing(false)} style={btnStyle("var(--muted)", "var(--fg-dim)", "0.72rem")}>Abbrechen</button>
          <button onClick={handleSave} disabled={!label.trim()} style={btnStyle(label.trim() ? "var(--accent)" : "var(--muted)", label.trim() ? "#fff" : "var(--fg-dim)", "0.72rem")}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

export default function CategorySettings({ theme }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [newColor, setNewColor] = useState("#888");
  const [newDesc, setNewDesc] = useState("");

  const load = async () => {
    try { const data = await api.getAllCategories(); setCategories(data); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleNewIconChange = (icon) => {
    setNewIcon(icon);
    const autoColor = colorForIcon(icon);
    if (autoColor) setNewColor(autoColor);
  };

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    const slug = newLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const icon = newIcon || suggestIcons(newLabel)[0];
    const color = newColor === "#888" ? (colorForIcon(icon) || "#888") : newColor;
    await api.createCategory(slug, newLabel.trim(), icon, color, newDesc, categories.length + 1);
    setNewLabel(""); setNewIcon(""); setNewColor("#888"); setNewDesc(""); setShowNew(false);
    load();
  };

  return (
    <div style={pageStyle(theme)}>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>🏷️ Wert-Kategorien</h2>
        <p style={{ fontSize: "0.72rem", color: "var(--fg-dim)", margin: "0.2rem 0 0" }}>
          Kategorien definieren, worauf deine Arbeit einzahlt
        </p>
      </div>

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--fg-dim)" }}>Laden...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {categories.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} onSave={handleSave} onToggle={handleToggle} />
          ))}

          {!showNew ? (
            <button onClick={() => setShowNew(true)} style={{
              ...btnStyle("transparent", "var(--accent)", "0.75rem"),
              border: "1px dashed var(--border)", width: "100%", padding: "0.6rem",
            }}>
              + Neue Kategorie
            </button>
          ) : (
            <div style={{ padding: "0.8rem", background: "var(--card-bg)", borderRadius: 8, border: "2px solid var(--accent)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newLabel.trim()) handleCreate(); }}
                  placeholder="Name (z.B. Marketing)" autoFocus style={inputStyle} />
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Beschreibung (optional)" style={{ ...inputStyle, fontSize: "0.75rem" }} />
                <IconPicker value={newIcon} onChange={handleNewIconChange} name={newLabel} />
                <div>
                  <div style={{ fontSize: "0.6rem", color: "var(--fg-dim)", fontWeight: 600, marginBottom: "0.2rem" }}>Farbe</div>
                  <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    {PRESET_COLORS.map((c) => (
                      <button key={c} onClick={() => setNewColor(c)} style={{
                        width: 22, height: 22, borderRadius: "50%", background: c,
                        border: newColor === c ? "3px solid var(--fg)" : "2px solid transparent", cursor: "pointer",
                      }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end" }}>
                  <button onClick={() => { setShowNew(false); setNewLabel(""); setNewIcon(""); setNewColor("#888"); setNewDesc(""); }} style={btnStyle("var(--muted)", "var(--fg-dim)", "0.72rem")}>Abbrechen</button>
                  <button onClick={handleCreate} disabled={!newLabel.trim()} style={btnStyle(newLabel.trim() ? "var(--accent)" : "var(--muted)", newLabel.trim() ? "#fff" : "var(--fg-dim)", "0.72rem")}>Anlegen</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  function handleSave(id, data) { return api.updateCategory(id, data).then(load); }
  function handleToggle(id, active) {
    const cat = categories.find((c) => c.id === id);
    if (cat) return api.updateCategory(id, { ...cat, active: active ? 1 : 0 }).then(load);
  }
}
