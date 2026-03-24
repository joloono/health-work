import { useState, useEffect } from "react";
import { api } from "./api.js";
import { btnStyle, inputStyle, pageStyle } from "./constants.js";

const PRESET_COLORS = ["#f5c842", "#7ec4e8", "#b88a70", "#e8945a", "#a09c92", "#c44d2b", "#2d8a4e", "#7c6bc4", "#e85a8a", "#5a9ee8"];

function CategoryCard({ cat, onSave, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(cat.label);
  const [icon, setIcon] = useState(cat.icon);
  const [color, setColor] = useState(cat.color);
  const [desc, setDesc] = useState(cat.description || "");

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
        <div style={{ width: 28, height: 28, borderRadius: 6, background: cat.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", flexShrink: 0 }}>
          {cat.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{cat.label}</div>
          {cat.description && <div style={{ fontSize: "0.62rem", color: "var(--fg-dim)", marginTop: "0.05rem" }}>{cat.description}</div>}
          <div style={{ fontSize: "0.55rem", color: "var(--fg-dim)", fontFamily: "'JetBrains Mono', monospace" }}>{cat.slug}</div>
        </div>
        <button onClick={() => setEditing(true)} style={{ ...btnStyle("transparent", "var(--fg-dim)", "0.68rem"), border: "1px solid var(--border)", padding: "0.2rem 0.5rem" }}>
          Bearbeiten
        </button>
        <button onClick={() => onToggle(cat.id, !cat.active)} style={{
          ...btnStyle("transparent", cat.active ? "var(--fg-dim)" : "var(--done)", "0.68rem"),
          border: "1px solid var(--border)", padding: "0.2rem 0.5rem",
        }}>
          {cat.active ? "Aus" : "Ein"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "0.8rem", background: "var(--card-bg)", borderRadius: 8, border: "2px solid var(--accent)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Icon" style={{ ...inputStyle, width: 50, textAlign: "center", fontSize: "1rem" }} />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name" style={{ ...inputStyle, flex: 1 }} />
        </div>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Beschreibung (optional)" style={{ ...inputStyle, fontSize: "0.75rem" }} />
        <div>
          <div style={{ fontSize: "0.62rem", color: "var(--fg-dim)", fontWeight: 600, marginBottom: "0.15rem" }}>Farbe</div>
          <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
            {PRESET_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 22, height: 22, borderRadius: "50%", background: c, border: color === c ? "3px solid var(--fg)" : "2px solid transparent",
                cursor: "pointer", flexShrink: 0,
              }} />
            ))}
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
  const [newSlug, setNewSlug] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [newColor, setNewColor] = useState("#888");

  const load = async () => {
    try { const data = await api.getAllCategories(); setCategories(data); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    const slug = newSlug.trim() || newLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    await api.createCategory(slug, newLabel.trim(), newIcon, newColor, "", categories.length + 1);
    setNewSlug(""); setNewLabel(""); setNewIcon(""); setNewColor("#888"); setShowNew(false);
    load();
  };

  const handleSave = async (id, data) => {
    await api.updateCategory(id, data);
    load();
  };

  const handleToggle = async (id, active) => {
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      await api.updateCategory(id, { ...cat, active: active ? 1 : 0 });
      load();
    }
  };

  return (
    <div style={pageStyle(theme)}>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>🏷️ Wert-Kategorien</h2>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="Icon" style={{ ...inputStyle, width: 50, textAlign: "center", fontSize: "1rem" }} />
                  <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Name (z.B. Marketing)" style={{ ...inputStyle, flex: 1 }} />
                </div>
                <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="Slug (optional, wird generiert)" style={{ ...inputStyle, fontSize: "0.72rem" }} />
                <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => setNewColor(c)} style={{
                      width: 22, height: 22, borderRadius: "50%", background: c, border: newColor === c ? "3px solid var(--fg)" : "2px solid transparent",
                      cursor: "pointer",
                    }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end" }}>
                  <button onClick={() => setShowNew(false)} style={btnStyle("var(--muted)", "var(--fg-dim)", "0.72rem")}>Abbrechen</button>
                  <button onClick={handleCreate} disabled={!newLabel.trim()} style={btnStyle(newLabel.trim() ? "var(--accent)" : "var(--muted)", newLabel.trim() ? "#fff" : "var(--fg-dim)", "0.72rem")}>Anlegen</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
