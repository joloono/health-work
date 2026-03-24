import { useState, useEffect } from "react";
import { api } from "./api.js";
import { VALUE_TAGS, CATEGORY_COLORS, btnStyle, chipStyle, inputStyle, labelStyle, pageStyle } from "./constants.js";

const PRESET_COLORS = ["#f5c842", "#7ec4e8", "#b88a70", "#e8945a", "#a09c92", "#c44d2b", "#2d8a4e", "#7c6bc4"];
const btn = btnStyle;

function ProjectCard({ project, onSave, onToggleActive }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [color, setColor] = useState(project.color || "#c44d2b");
  const [defaultCat, setDefaultCat] = useState(project.default_value_category || "");
  const [client, setClient] = useState(project.client || "");

  const handleSave = async () => {
    await onSave(project.id, { name, description, color, default_value_category: defaultCat, client, active: project.active });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.8rem",
        background: "var(--card-bg)", borderRadius: 8, border: "1px solid var(--border)",
        opacity: project.active ? 1 : 0.5,
      }}>
        <div style={{ width: 6, height: 32, borderRadius: 3, background: project.color || "var(--accent)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{project.name}</div>
          {project.description && <div style={{ fontSize: "0.65rem", color: "var(--fg-dim)", marginTop: "0.1rem" }}>{project.description}</div>}
          <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.15rem", flexWrap: "wrap" }}>
            {project.default_value_category && (
              <span style={{
                fontSize: "0.55rem", padding: "0.1rem 0.3rem", borderRadius: 3,
                background: `${CATEGORY_COLORS[project.default_value_category]?.color || "var(--fg-dim)"}20`,
                color: CATEGORY_COLORS[project.default_value_category]?.color || "var(--fg-dim)",
                fontWeight: 600,
              }}>
                {CATEGORY_COLORS[project.default_value_category]?.label || project.default_value_category}
              </span>
            )}
            {project.client && <span style={{ fontSize: "0.55rem", color: "var(--fg-dim)" }}>{project.client}</span>}
          </div>
        </div>
        <button onClick={() => setEditing(true)} style={{ ...btn("transparent", "var(--fg-dim)", "0.7rem"), border: "1px solid var(--border)", padding: "0.25rem 0.5rem" }}>
          Bearbeiten
        </button>
        <button onClick={() => onToggleActive(project.id, !project.active)} style={{
          ...btn("transparent", project.active ? "var(--fg-dim)" : "var(--done)", "0.7rem"),
          border: "1px solid var(--border)", padding: "0.25rem 0.5rem",
        }}>
          {project.active ? "Deaktivieren" : "Aktivieren"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "0.8rem", background: "var(--card-bg)", borderRadius: 8, border: "2px solid var(--accent)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Projektname"
          style={{ padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.82rem", fontFamily: "inherit", background: "var(--bg)", color: "var(--fg)" }} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beschreibung (optional)"
          style={{ padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.75rem", fontFamily: "inherit", background: "var(--bg)", color: "var(--fg)" }} />
        <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Kunde (optional)"
          style={{ padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.75rem", fontFamily: "inherit", background: "var(--bg)", color: "var(--fg)" }} />

        <div>
          <div style={{ fontSize: "0.65rem", color: "var(--fg-dim)", fontWeight: 600, marginBottom: "0.2rem" }}>Farbe</div>
          <div style={{ display: "flex", gap: "0.3rem" }}>
            {PRESET_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 24, height: 24, borderRadius: "50%", background: c, border: color === c ? "3px solid var(--fg)" : "2px solid transparent",
                cursor: "pointer", flexShrink: 0,
              }} />
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.65rem", color: "var(--fg-dim)", fontWeight: 600, marginBottom: "0.2rem" }}>Default-Kategorie</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
            <button onClick={() => setDefaultCat("")} style={{
              padding: "0.2rem 0.4rem", borderRadius: 4, fontSize: "0.6rem", fontFamily: "inherit", cursor: "pointer",
              border: !defaultCat ? "2px solid var(--fg)" : "1px solid var(--border)",
              background: "transparent", color: "var(--fg-dim)",
            }}>Keine</button>
            {VALUE_TAGS.map((t) => (
              <button key={t.id} onClick={() => setDefaultCat(t.id)} style={{
                padding: "0.2rem 0.4rem", borderRadius: 4, fontSize: "0.6rem", fontFamily: "inherit", cursor: "pointer",
                border: defaultCat === t.id ? `2px solid ${t.color}` : "1px solid var(--border)",
                background: defaultCat === t.id ? `${t.color}20` : "transparent",
                color: defaultCat === t.id ? t.color : "var(--fg-dim)",
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end" }}>
          <button onClick={() => setEditing(false)} style={{ ...btn("var(--muted)", "var(--fg-dim)", "0.75rem") }}>Abbrechen</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{ ...btn(name.trim() ? "var(--accent)" : "var(--muted)", name.trim() ? "#fff" : "var(--fg-dim)", "0.75rem") }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectSettings({ theme }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const load = async () => {
    const all = await api.getProjects();
    // Also get inactive
    try {
      const resp = await fetch("/api/projects?all=1", {
        headers: { "Content-Type": "application/json", Authorization: `Basic ${localStorage.getItem("health-auth") || btoa("jo:health2026")}` },
      });
      const data = await resp.json();
      setProjects(data);
    } catch {
      setProjects(all);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await api.createProject(newName.trim());
    setNewName("");
    setShowNew(false);
    load();
  };

  const handleSave = async (id, data) => {
    await api.updateProject(id, data);
    load();
  };

  const handleToggle = async (id, active) => {
    const proj = projects.find((p) => p.id === id);
    if (proj) {
      await api.updateProject(id, { ...proj, active: active ? 1 : 0 });
      load();
    }
  };

  return (
    <div style={pageStyle(theme)}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>📁 Projekte</h2>
      </div>

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--fg-dim)" }}>Laden...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onSave={handleSave} onToggleActive={handleToggle} />
          ))}

          {!showNew ? (
            <button onClick={() => setShowNew(true)} style={{
              ...btn("transparent", "var(--accent)", "0.78rem"),
              border: "1px dashed var(--border)", width: "100%", padding: "0.6rem",
            }}>
              + Neues Projekt
            </button>
          ) : (
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                placeholder="Projektname..."
                style={{ flex: 1, padding: "0.45rem 0.6rem", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.82rem", fontFamily: "inherit", background: "var(--bg)", color: "var(--fg)" }} />
              <button onClick={handleCreate} disabled={!newName.trim()} style={btn(newName.trim() ? "var(--accent)" : "var(--muted)", newName.trim() ? "#fff" : "var(--fg-dim)", "0.78rem")}>
                Anlegen
              </button>
              <button onClick={() => { setShowNew(false); setNewName(""); }} style={{ ...btn("var(--muted)", "var(--fg-dim)", "0.78rem") }}>
                ×
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
