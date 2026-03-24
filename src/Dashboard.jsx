import { useState, useEffect } from "react";
import { api } from "./api.js";
import { btnStyle, pageStyle, CATEGORY_COLORS } from "./constants.js";

// --- Shared helpers ---

const ENERGY_MAP = { "-2": { icon: "🔴🔴", label: "drain" }, "-1": { icon: "🔴", label: "müde" }, "0": { icon: "⚪", label: "neutral" }, "1": { icon: "🟢", label: "gut" }, "2": { icon: "🟢🟢", label: "Feuer" } };
const BIZ_MAP = { 1: "◐", 2: "●", 3: "●●", 4: "●●●" };
const fmt = (n) => typeof n === "number" ? n.toLocaleString("de-CH") : "–";
const fmtTime = (ts) => { try { return new Date(ts + "Z").toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

function StatCard({ value, label, sub, color = "var(--fg)" }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
      <div style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "1.5rem", fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: "0.6rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginTop: "0.15rem" }}>{label}</div>
      {sub && <div style={{ fontSize: "0.55rem", color: "var(--fg-dim)", marginTop: "0.1rem" }}>{sub}</div>}
    </div>
  );
}

function EnergyBar({ value, max = 2 }) {
  const pct = ((value + max) / (max * 2)) * 100;
  const color = value > 0 ? "var(--done)" : value < 0 ? "var(--accent)" : "var(--fg-dim)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "var(--fg-dim)", opacity: 0.3 }} />
        <div style={{
          height: "100%", borderRadius: 2, background: color, transition: "width 0.3s ease",
          width: `${pct}%`, marginLeft: value < 0 ? "auto" : 0,
        }} />
      </div>
      <span style={{ fontSize: "0.6rem", fontFamily: "'JetBrains Mono', 'SF Mono', monospace", color, fontWeight: 600, minWidth: "1.5rem", textAlign: "right" }}>
        {value > 0 ? "+" : ""}{value}
      </span>
    </div>
  );
}

// ============================================================
// TAGESLOG
// ============================================================

function Tageslog({ dayData }) {
  if (!dayData) return <Empty text="Keine Daten" />;
  const { pomodoros, movements } = dayData;
  const completed = pomodoros.filter((p) => p.completed_at);

  if (!completed.length && !movements.length) return <Empty text="Noch keine Aktivitäten heute. Starte deinen ersten Pomodoro!" />;

  const totalPom = completed.length;
  const totalMin = completed.reduce((s, p) => s + (p.duration_minutes || 25), 0);
  const totalBiz = completed.reduce((s, p) => s + (p.biz_rating || 0), 0);
  const totalEnergy = completed.reduce((s, p) => s + (p.energy_rating || 0), 0);
  const avgBiz = totalPom > 0 ? (totalBiz / totalPom).toFixed(1) : "–";
  const avgEnergy = totalPom > 0 ? (totalEnergy / totalPom).toFixed(1) : "–";

  // Build timeline events
  const events = [
    ...pomodoros.map((p) => ({ ...p, _type: "pom", _time: p.completed_at || p.started_at })),
    ...movements.map((m) => ({ ...m, _type: m.type, _time: m.completed_at })),
  ].sort((a, b) => (a._time || "").localeCompare(b._time || ""));

  return (
    <div>
      {/* Summary strip */}
      <div style={{
        display: "flex", gap: "0.3rem", padding: "0.8rem 0.5rem", marginBottom: "1rem",
        background: "var(--muted)", borderRadius: 10,
      }}>
        <StatCard value={totalPom} label="Pomodoros" sub={`${totalMin} min`} color="var(--accent)" />
        <StatCard value={avgBiz} label="Ø Wert" sub={BIZ_MAP[Math.round(avgBiz)] || ""} color="var(--accent)" />
        <StatCard value={`${totalEnergy > 0 ? "+" : ""}${totalEnergy}`} label="Energie" sub={avgEnergy > 0 ? "positiv" : avgEnergy < 0 ? "drain" : "neutral"} color={totalEnergy > 0 ? "var(--done)" : totalEnergy < 0 ? "var(--accent)" : "var(--fg-dim)"} />
      </div>

      {/* Timeline */}
      <div style={{ position: "relative", paddingLeft: "3.2rem" }}>
        {/* Vertical line */}
        <div style={{ position: "absolute", left: "2.6rem", top: 0, bottom: 0, width: 2, background: "var(--border)", borderRadius: 1 }} />

        {events.map((ev, i) => {
          if (ev._type === "pom") {
            return (
              <div key={`p-${i}`} style={{ position: "relative", marginBottom: "0.5rem" }}>
                {/* Time label */}
                <div style={{
                  position: "absolute", left: "-3.2rem", top: "0.3rem", width: "2.4rem",
                  fontSize: "0.58rem", fontFamily: "'JetBrains Mono', 'SF Mono', monospace", color: "var(--fg-dim)", textAlign: "right",
                }}>
                  {fmtTime(ev._time)}
                </div>
                {/* Dot */}
                <div style={{
                  position: "absolute", left: "-0.95rem", top: "0.45rem",
                  width: 10, height: 10, borderRadius: "50%",
                  background: ev.completed_at ? "var(--accent)" : "var(--border)",
                  border: "2px solid var(--bg)",
                }} />
                {/* Card */}
                <div style={{
                  padding: "0.5rem 0.7rem", background: "var(--card-bg)", borderRadius: 8,
                  borderLeft: `3px solid ${ev.project_color || "var(--border)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.2rem", flexWrap: "wrap" }}>
                    {ev.project_name && (
                      <span style={{
                        fontSize: "0.55rem", background: `${ev.project_color || "var(--accent)"}20`,
                        color: ev.project_color || "var(--accent)", borderRadius: 3, padding: "0.05rem 0.35rem", fontWeight: 700,
                      }}>
                        {ev.project_name}
                      </span>
                    )}
                    <span style={{ fontSize: "0.55rem", color: "var(--fg-dim)" }}>{{"pomodoro":"🎯","meeting":"👥","walk":"🚶","recreation":"☕","eating":"🍽️","note":"📝"}[ev.entry_type] || "🎯"} {ev.duration_minutes || 25}min</span>
                    {ev.retroactive ? <span style={{ fontSize: "0.5rem", color: "var(--fg-dim)", fontStyle: "italic" }}>retro</span> : null}
                  </div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 500, lineHeight: 1.35 }}>{ev.intention}</div>
                  {(ev.biz_rating != null || ev.energy_rating != null) && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.3rem" }}>
                      {ev.biz_rating != null && (
                        <span style={{ fontSize: "0.6rem", color: "var(--accent)", fontWeight: 600 }}>
                          Wert {BIZ_MAP[ev.biz_rating] || "–"}
                        </span>
                      )}
                      {ev.energy_rating != null && (
                        <span style={{ fontSize: "0.6rem" }}>
                          {ENERGY_MAP[String(ev.energy_rating)]?.icon || "⚪"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          }
          // Movement (mini or block)
          return (
            <div key={`m-${i}`} style={{ position: "relative", marginBottom: "0.4rem" }}>
              <div style={{
                position: "absolute", left: "-3.2rem", top: "0.15rem", width: "2.4rem",
                fontSize: "0.55rem", fontFamily: "'JetBrains Mono', 'SF Mono', monospace", color: "var(--fg-dim)", textAlign: "right",
              }}>
                {fmtTime(ev._time)}
              </div>
              <div style={{
                position: "absolute", left: "-0.8rem", top: "0.25rem",
                width: 6, height: 6, borderRadius: 2, background: "var(--done)",
              }} />
              <div style={{ fontSize: "0.68rem", color: "var(--done)", fontWeight: 500, padding: "0.1rem 0" }}>
                {ev._type === "mini" ? "↑" : "🚶"} {(ev.exercise || "").split(",").join(" + ")}
                {ev._type === "block" && ev.duration_seconds > 0 && ` (${Math.round(ev.duration_seconds / 60)} min)`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// PROJEKT VIEW
// ============================================================

function ProjektView({ dayData }) {
  const [expanded, setExpanded] = useState(null);
  if (!dayData) return <Empty text="Keine Daten" />;
  const { pomodoros } = dayData;
  const completed = pomodoros.filter((p) => p.completed_at);

  if (!completed.length) return <Empty text="Noch keine abgeschlossenen Pomodoros heute." />;

  const byProject = {};
  for (const p of completed) {
    const key = p.project_id || "none";
    if (!byProject[key]) {
      byProject[key] = { id: key, name: p.project_name || "Ohne Projekt", color: p.project_color || "var(--fg-dim)", poms: [], bizSum: 0, energySum: 0 };
    }
    byProject[key].poms.push(p);
    byProject[key].bizSum += p.biz_rating || 0;
    byProject[key].energySum += p.energy_rating || 0;
  }

  const projects = Object.values(byProject).sort((a, b) => b.poms.length - a.poms.length);
  const maxPoms = Math.max(...projects.map((p) => p.poms.length), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {projects.map((proj) => {
        const isOpen = expanded === proj.id;
        const avgBiz = proj.poms.length > 0 ? proj.bizSum / proj.poms.length : 0;
        const barWidth = (proj.poms.length / maxPoms) * 100;

        return (
          <div key={proj.id}>
            {/* Collapsed card */}
            <button onClick={() => setExpanded(isOpen ? null : proj.id)} className="card-interactive" style={{
              width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
              padding: "0.65rem 0.8rem", background: "var(--card-bg)", borderRadius: isOpen ? "8px 8px 0 0" : 8,
              border: isOpen ? "1px solid var(--accent)" : "1px solid var(--border)",
              borderBottom: isOpen ? "none" : undefined,
              display: "flex", flexDirection: "column", gap: "0.35rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: 4, height: 28, borderRadius: 2, background: proj.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{proj.name}</div>
                  <div style={{ display: "flex", gap: "0.8rem", fontSize: "0.62rem", color: "var(--fg-dim)", marginTop: "0.1rem" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontWeight: 600 }}>{proj.poms.length}× 25min</span>
                    <span>Wert {BIZ_MAP[Math.round(avgBiz)] || "–"}</span>
                    <span>{proj.energySum > 0 ? "+" : ""}{proj.energySum} Energie</span>
                  </div>
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--fg-dim)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
              </div>
              {/* Proportional bar */}
              <div style={{ height: 3, borderRadius: 2, background: "var(--border)", overflow: "hidden", marginLeft: "0.8rem" }}>
                <div style={{ height: "100%", width: `${barWidth}%`, background: proj.color, borderRadius: 2, transition: "width 0.3s" }} />
              </div>
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{
                border: "1px solid var(--accent)", borderTop: "none",
                borderRadius: "0 0 8px 8px", background: "var(--bg)", padding: "0.5rem",
              }}>
                {proj.poms.map((p, pi) => (
                  <div key={pi} style={{
                    padding: "0.4rem 0.5rem", borderRadius: 6,
                    background: pi % 2 === 0 ? "var(--card-bg)" : "transparent",
                    display: "flex", alignItems: "flex-start", gap: "0.4rem",
                  }}>
                    <span style={{ fontSize: "0.55rem", fontFamily: "'JetBrains Mono', 'SF Mono', monospace", color: "var(--fg-dim)", minWidth: "2.5rem", paddingTop: "0.1rem" }}>
                      {fmtTime(p.completed_at || p.started_at)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.72rem", lineHeight: 1.35 }}>{p.intention}</div>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.15rem", fontSize: "0.55rem", color: "var(--fg-dim)" }}>
                        {p.biz_rating != null && <span style={{ color: "var(--accent)" }}>{BIZ_MAP[p.biz_rating]}</span>}
                        {p.energy_rating != null && <span>{ENERGY_MAP[String(p.energy_rating)]?.icon}</span>}
                        {p.retroactive ? <span style={{ fontStyle: "italic" }}>retro</span> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// WOCHENÜBERBLICK
// ============================================================

function Wochenüberblick({ weekData }) {
  if (!weekData || !weekData.length) return <Empty text="Noch keine Wochendaten vorhanden." />;

  const today = new Date().toISOString().slice(0, 10);
  const dayLabels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  // Aggregates
  const totalPom = weekData.reduce((s, d) => s + d.pom_count, 0);
  const totalMin = weekData.reduce((s, d) => s + (d.total_minutes || d.pom_count * 25), 0);
  const totalXP = weekData.reduce((s, d) => s + (d.effective_xp || 0), 0);
  const totalMove = weekData.reduce((s, d) => s + Math.round(d.move_seconds / 60), 0);
  const maxStreak = Math.max(...weekData.map((d) => d.streak_day || 0));
  const avgBiz = totalPom > 0 ? (weekData.reduce((s, d) => s + d.biz_rating_sum, 0) / totalPom).toFixed(1) : "–";

  // Chart data
  const maxPom = Math.max(...weekData.map((d) => d.pom_count), 1);
  const maxXP = Math.max(...weekData.map((d) => d.effective_xp || 0), 1);
  const chartH = 100;

  return (
    <div>
      {/* Key metrics */}
      <div style={{
        display: "flex", gap: "0.3rem", padding: "0.8rem 0.5rem", marginBottom: "1rem",
        background: "var(--muted)", borderRadius: 10,
      }}>
        <StatCard value={fmt(totalXP)} label="XP" color="var(--accent)" />
        <StatCard value={totalMin} label="Fokuszeit" sub={`${totalPom} Einträge`} />
        <StatCard value={`${totalMove}`} label="Bewegung" sub="Minuten" color="var(--done)" />
        <StatCard value={maxStreak} label="Streak" sub="Tage" color={maxStreak > 0 ? "var(--done)" : "var(--fg-dim)"} />
      </div>

      {/* Combined chart: bars (poms) + line (XP) */}
      <div style={{ marginBottom: "1.2rem" }}>
        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
          Pomodoros & XP pro Tag
        </div>
        <div style={{ position: "relative", height: chartH + 24, padding: "0 0.1rem" }}>
          {/* Bars */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: chartH }}>
            {weekData.map((d, i) => {
              const barH = maxPom > 0 ? (d.pom_count / maxPom) * (chartH - 10) : 0;
              const isT = d.date === today;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: "0.5rem", fontWeight: 600, color: "var(--fg-dim)", marginBottom: 2 }}>{d.pom_count || ""}</div>
                  <div style={{
                    width: "100%", maxWidth: 32, height: Math.max(2, barH), borderRadius: "4px 4px 0 0",
                    background: isT ? "var(--accent)" : "var(--accent)55",
                    transition: "height 0.3s ease",
                  }} />
                </div>
              );
            })}
          </div>
          {/* XP line overlay */}
          <svg viewBox={`0 0 ${weekData.length * 60} ${chartH}`} width="100%" height={chartH}
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
            <polyline
              fill="none" stroke="var(--done)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              points={weekData.map((d, i) => {
                const x = (i + 0.5) * (weekData.length * 60 / weekData.length);
                const y = chartH - 10 - (maxXP > 0 ? ((d.effective_xp || 0) / maxXP) * (chartH - 20) : 0);
                return `${x},${y}`;
              }).join(" ")}
            />
            {weekData.map((d, i) => {
              const x = (i + 0.5) * (weekData.length * 60 / weekData.length);
              const y = chartH - 10 - (maxXP > 0 ? ((d.effective_xp || 0) / maxXP) * (chartH - 20) : 0);
              return <circle key={i} cx={x} cy={y} r="3" fill={d.date === today ? "var(--done)" : "var(--done)88"} />;
            })}
          </svg>
          {/* Day labels */}
          <div style={{ display: "flex", gap: "4px", marginTop: 4 }}>
            {weekData.map((d, i) => (
              <div key={i} style={{ flex: 1, fontSize: "0.5rem", textAlign: "center", color: d.date === today ? "var(--fg)" : "var(--fg-dim)", fontWeight: d.date === today ? 700 : 400 }}>
                {dayLabels[new Date(d.date).getDay()]}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "0.4rem", fontSize: "0.55rem", color: "var(--fg-dim)" }}>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--accent)", marginRight: 3, verticalAlign: "middle" }} />Pomodoros</span>
          <span><span style={{ display: "inline-block", width: 12, height: 2, borderRadius: 1, background: "var(--done)", marginRight: 3, verticalAlign: "middle" }} />XP</span>
        </div>
      </div>

      {/* Daily detail rows */}
      <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
        Tagesdetails
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        {weekData.slice().reverse().map((d, i) => {
          const isT = d.date === today;
          const dayName = new Date(d.date).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" });
          const avgE = d.pom_count > 0 ? d.biz_rating_sum / d.pom_count : 0;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.6rem",
              background: isT ? "var(--muted)" : "transparent", borderRadius: 6,
            }}>
              <span style={{ fontSize: "0.65rem", fontWeight: isT ? 700 : 400, color: isT ? "var(--fg)" : "var(--fg-dim)", minWidth: "5rem" }}>{dayName}</span>
              <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "0.65rem", fontWeight: 600, color: d.pom_count > 0 ? "var(--accent)" : "var(--fg-dim)", minWidth: "2rem" }}>{d.pom_count}p</span>
              <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)", minWidth: "3rem" }}>{d.effective_xp || 0} xp</span>
              <div style={{ flex: 1 }}>
                <EnergyBar value={d.pom_count > 0 ? Math.round(avgE) : 0} />
              </div>
              {d.streak_day > 0 && <span style={{ fontSize: "0.55rem", color: "var(--done)" }}>🔥{d.streak_day}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// AUDIT KALENDER
// ============================================================

function AuditKalender() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState([]);

  useEffect(() => { api.getCalendar(month).then(setData).catch(() => {}); }, [month]);

  const y = parseInt(month.slice(0, 4));
  const m = parseInt(month.slice(5, 7));
  const firstDay = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const dayMap = {};
  for (const d of data) dayMap[d.date] = d;

  const prevMonth = () => { const p = new Date(y, m - 2, 1); setMonth(`${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`); };
  const nextMonth = () => { const n = new Date(y, m, 1); setMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`); };
  const monthLabel = new Date(y, m - 1).toLocaleDateString("de-CH", { month: "long", year: "numeric" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
        <button onClick={prevMonth} className="btn-interactive" style={{ background: "var(--muted)", border: "none", borderRadius: 6, padding: "0.3rem 0.6rem", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", color: "var(--fg)" }}>←</button>
        <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: "1rem" }}>{monthLabel}</span>
        <button onClick={nextMonth} className="btn-interactive" style={{ background: "var(--muted)", border: "none", borderRadius: 6, padding: "0.3rem 0.6rem", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", color: "var(--fg)" }}>→</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" }}>
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
          <div key={d} style={{ fontSize: "0.55rem", color: "var(--fg-dim)", textAlign: "center", fontWeight: 600, padding: "0.3rem 0" }}>{d}</div>
        ))}
        {Array.from({ length: startOffset }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${month}-${String(day).padStart(2, "0")}`;
          const d = dayMap[dateStr];
          const poms = d?.pom_count || 0;
          const intensity = Math.min(1, poms / 8);
          const isToday = dateStr === new Date().toISOString().slice(0, 10);

          return (
            <div key={day} style={{
              aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              borderRadius: 6, fontSize: "0.62rem", fontFamily: "inherit",
              background: poms > 0
                ? `rgba(196, 77, 43, ${0.1 + intensity * 0.35})`
                : isToday ? "var(--muted)" : "var(--card-bg)",
              border: isToday ? "2px solid var(--accent)" : "none",
              color: "var(--fg)", fontWeight: isToday ? 700 : 400,
            }}>
              <span>{day}</span>
              {poms > 0 && (
                <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "0.45rem", color: poms >= 8 ? "var(--accent)" : "var(--fg-dim)", fontWeight: 600 }}>
                  {poms}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", marginTop: "0.6rem", fontSize: "0.5rem", color: "var(--fg-dim)" }}>
        <span>wenig</span>
        {[0.1, 0.2, 0.3, 0.45].map((op, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 3, background: `rgba(196, 77, 43, ${op})` }} />
        ))}
        <span>viel</span>
      </div>
    </div>
  );
}

// ============================================================
// SHARED
// ============================================================

function Empty({ text }) {
  return <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--fg-dim)", fontSize: "0.82rem", fontStyle: "italic" }}>{text}</div>;
}

// ============================================================
// MAIN DASHBOARD
// ============================================================

export default function Dashboard({ theme }) {
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
      } catch (e) { console.error("Dashboard load failed:", e); }
      setLoading(false);
    })();
  }, []);

  const tabs = [
    { id: "tageslog", label: "Tag" },
    { id: "projekte", label: "Projekte" },
    { id: "woche", label: "Woche" },
    { id: "kalender", label: "Kalender" },
  ];

  return (
    <div style={pageStyle(theme)}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Cormorant+Garamond:wght@600;700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>📊 Dashboard</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.2rem", background: "var(--muted)", borderRadius: 8, padding: "0.2rem" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="btn-interactive" style={{
            flex: 1, padding: "0.45rem 0.3rem", borderRadius: 6, fontSize: "0.68rem", fontWeight: 600,
            fontFamily: "inherit", cursor: "pointer", border: "none",
            background: tab === t.id ? "var(--card-bg)" : "transparent",
            color: tab === t.id ? "var(--accent)" : "var(--fg-dim)",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--fg-dim)" }}>Laden...</div>
      ) : (
        <>
          {tab === "tageslog" && <Tageslog dayData={dayData} />}
          {tab === "projekte" && <ProjektView dayData={dayData} />}
          {tab === "woche" && <Wochenüberblick weekData={weekData} />}
          {tab === "kalender" && <AuditKalender />}
        </>
      )}
    </div>
  );
}
