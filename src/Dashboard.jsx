import { useState, useEffect } from "react";
import { api } from "./api.js";

function btnStyle(bg, fg, size = "0.88rem") {
  return {
    background: bg, color: fg, border: "none", borderRadius: 8,
    padding: "0.5rem 1.4rem", fontSize: size, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  };
}

function BarChart({ data, maxValue, label, color = "var(--accent)", height = 120 }) {
  if (!data.length) return null;
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height, padding: "0 0.2rem" }}>
        {data.map((d, i) => {
          const barH = max > 0 ? (d.value / max) * (height - 20) : 0;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              <div style={{ fontSize: "0.55rem", fontWeight: 600, color: "var(--fg-dim)" }}>{d.value}</div>
              <div style={{
                width: "100%", maxWidth: 36, height: Math.max(2, barH), borderRadius: "4px 4px 0 0",
                background: d.isToday ? color : `${color}88`,
                transition: "height 0.3s ease",
              }} />
              <div style={{ fontSize: "0.5rem", color: "var(--fg-dim)", whiteSpace: "nowrap" }}>{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ENERGY_ICONS = { "-2": "🔴🔴", "-1": "🔴", "0": "⚪", "1": "🟢", "2": "🟢🟢" };
const BIZ_LABELS = { 1: "gering", 2: "mittel", 3: "hoch", 4: "sehr hoch" };

function Tageslog({ dayData }) {
  if (!dayData) return <div style={{ padding: "1rem", textAlign: "center", color: "var(--fg-dim)" }}>Keine Daten</div>;

  const { pomodoros, movements } = dayData;

  const events = [
    ...pomodoros.map((p) => ({
      type: "pomodoro",
      time: p.completed_at || p.started_at,
      block: p.block_index,
      pom: p.pom_index,
      intention: p.intention,
      projectName: p.project_name,
      projectColor: p.project_color,
      bizRating: p.biz_rating,
      energyRating: p.energy_rating,
      completed: !!p.completed_at,
    })),
    ...movements.map((m) => ({
      type: m.type === "mini" ? "mini-move" : "block-pause",
      time: m.completed_at,
      block: m.block_index,
      exercise: m.exercise,
      duration: m.duration_seconds,
    })),
  ].sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  if (!events.length) {
    return (
      <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--fg-dim)", fontSize: "0.85rem" }}>
        Noch keine Aktivitäten heute. Starte deinen ersten Pomodoro!
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      {events.map((ev, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.6rem",
          background: "var(--card-bg)", borderRadius: 8, border: "1px solid var(--border)",
          fontSize: "0.75rem",
        }}>
          <span style={{ fontSize: "1rem", minWidth: "1.5rem", textAlign: "center" }}>
            {ev.type === "pomodoro" ? "🍅" : ev.type === "mini-move" ? "↑" : "🚶"}
          </span>
          <div style={{ flex: 1 }}>
            {ev.type === "pomodoro" && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600 }}>Block {["I","II","III","IV"][ev.block]}.{ev.pom + 1}</span>
                {ev.projectName && (
                  <span style={{ fontSize: "0.55rem", background: ev.projectColor || "var(--accent)", color: "#fff", borderRadius: 3, padding: "0 4px", fontWeight: 600 }}>
                    {ev.projectName}
                  </span>
                )}
                <span>{ev.intention}</span>
                {ev.bizRating != null && (
                  <span style={{ fontSize: "0.55rem", color: "var(--accent)", fontWeight: 600 }} title={`Geschäftswert: ${BIZ_LABELS[ev.bizRating]}`}>
                    {"●".repeat(ev.bizRating)}
                  </span>
                )}
                {ev.energyRating != null && (
                  <span style={{ fontSize: "0.55rem" }} title={`Energie: ${ev.energyRating}`}>
                    {ENERGY_ICONS[String(ev.energyRating)] || "⚪"}
                  </span>
                )}
              </div>
            )}
            {ev.type === "mini-move" && <div><span style={{ fontWeight: 600 }}>Mini-Move:</span> {ev.exercise}</div>}
            {ev.type === "block-pause" && <div><span style={{ fontWeight: 600 }}>Block-Pause:</span> {ev.exercise} ({Math.round(ev.duration / 60)} min)</div>}
          </div>
          {ev.time && (
            <span style={{ fontSize: "0.6rem", color: "var(--fg-dim)", whiteSpace: "nowrap" }}>
              {new Date(ev.time + "Z").toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ProjektView({ dayData }) {
  if (!dayData) return null;
  const { pomodoros } = dayData;
  const completed = pomodoros.filter((p) => p.completed_at);

  // Group by project
  const byProject = {};
  for (const p of completed) {
    const key = p.project_id || "none";
    if (!byProject[key]) {
      byProject[key] = { name: p.project_name || "Ohne Projekt", color: p.project_color || "var(--fg-dim)", poms: 0, bizSum: 0, energySum: 0 };
    }
    byProject[key].poms++;
    byProject[key].bizSum += p.biz_rating || 0;
    byProject[key].energySum += p.energy_rating || 0;
  }

  const projects = Object.values(byProject).sort((a, b) => b.poms - a.poms);

  if (!projects.length) {
    return (
      <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--fg-dim)", fontSize: "0.85rem" }}>
        Noch keine abgeschlossenen Pomodoros heute.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {projects.map((p, i) => (
        <div key={i} style={{
          padding: "0.6rem 0.8rem", background: "var(--card-bg)", borderRadius: 8,
          border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.6rem",
        }}>
          <div style={{ width: 4, height: 36, borderRadius: 2, background: p.color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{p.name}</div>
            <div style={{ fontSize: "0.68rem", color: "var(--fg-dim)", display: "flex", gap: "0.8rem", marginTop: "0.15rem" }}>
              <span>{p.poms} Pom{p.poms !== 1 ? "s" : ""} ({p.poms * 25} min)</span>
              <span>Wert: {"●".repeat(Math.round(p.bizSum / p.poms)) || "–"}</span>
              <span>Energie: {p.energySum > 0 ? "+" : ""}{p.energySum}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Wochenüberblick({ weekData }) {
  if (!weekData || !weekData.length) {
    return (
      <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--fg-dim)", fontSize: "0.85rem" }}>
        Noch keine Wochendaten vorhanden.
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  const pomData = weekData.map((d) => ({
    value: d.pom_count,
    label: dayNames[new Date(d.date).getDay()],
    isToday: d.date === today,
  }));

  const moveData = weekData.map((d) => ({
    value: Math.round(d.move_seconds / 60),
    label: dayNames[new Date(d.date).getDay()],
    isToday: d.date === today,
  }));

  const bizData = weekData.map((d) => ({
    value: d.pom_count > 0 ? +(d.biz_rating_sum / d.pom_count).toFixed(1) : 0,
    label: dayNames[new Date(d.date).getDay()],
    isToday: d.date === today,
  }));

  const pointsData = weekData.map((d) => ({
    value: d.total_points,
    label: dayNames[new Date(d.date).getDay()],
    isToday: d.date === today,
  }));

  return (
    <div>
      <BarChart data={pomData} maxValue={16} label="Pomodoros pro Tag" color="var(--accent)" />
      <BarChart data={moveData} maxValue={null} label="Bewegungsminuten pro Tag" color="var(--done)" />
      <BarChart data={bizData} maxValue={4} label="Durchschn. Geschäftswert" color="var(--accent)" />
      <BarChart data={pointsData} maxValue={120} label="Punkte pro Tag" color="var(--done)" />
    </div>
  );
}

export default function Dashboard({ onBack, theme }) {
  const [tab, setTab] = useState("tageslog");
  const [dayData, setDayData] = useState(null);
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [today, week] = await Promise.all([api.getToday(), api.getWeekSummary()]);
        setDayData(today);
        setWeekData(week);
      } catch (e) {
        console.error("Dashboard load failed:", e);
      }
      setLoading(false);
    })();
  }, []);

  const tabs = [
    { id: "tageslog", label: "Tageslog" },
    { id: "projekte", label: "Projekte" },
    { id: "woche", label: "Woche" },
  ];

  return (
    <div style={{
      ...theme,
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      maxWidth: 480, margin: "0 auto", padding: "1.5rem 1rem", color: "var(--fg)",
      minHeight: "100vh", background: "var(--bg)",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet" />

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <button onClick={onBack} style={{ ...btnStyle("transparent", "var(--fg-dim)", "0.8rem"), border: "1px solid var(--border)", padding: "0.3rem 0.8rem" }}>
          ← Zurück
        </button>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Dashboard</h2>
      </div>

      <div style={{ display: "flex", gap: "0.3rem", marginBottom: "1rem" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "0.5rem", borderRadius: 8, fontSize: "0.72rem", fontWeight: 600,
            fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s ease",
            border: tab === t.id ? "2px solid var(--accent)" : "1px solid var(--border)",
            background: tab === t.id ? "rgba(196,77,43,0.08)" : "var(--card-bg)",
            color: tab === t.id ? "var(--accent)" : "var(--fg-dim)",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--fg-dim)" }}>Laden...</div>
      ) : (
        <>
          {tab === "tageslog" && <Tageslog dayData={dayData} />}
          {tab === "projekte" && <ProjektView dayData={dayData} />}
          {tab === "woche" && <Wochenüberblick weekData={weekData} />}
        </>
      )}
    </div>
  );
}
