import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api.js";
import { getRank, calcDayXPFlex, calcEffectiveXP, getStreakMultiplier, getLevelProgress, xpForLevel } from "./gamification.js";
import { playNotificationSound } from "./useSettings.js";
import { VALUE_TAGS, CATEGORY_COLORS, btnStyle, chipStyle, inputStyle, pageStyle, labelStyle } from "./constants.js";

// --- Constants ---

const QUICK_MOVES = [
  { id: "pushups", label: "Liegestütze", icon: "💪" },
  { id: "pullups", label: "Klimmzüge", icon: "🏋️" },
  { id: "squats", label: "Kniebeugen", icon: "🦵" },
  { id: "plank", label: "Plank", icon: "🧱" },
  { id: "stretch", label: "Dehnen", icon: "🧘" },
  { id: "rope", label: "Seilspringen", icon: "🪢" },
];

const DURATION_OPTIONS = [
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 25, label: "25 min" },
  { value: 60, label: "60 min" },
];

const ENTRY_TYPES = [
  { value: "pomodoro", label: "Fokus", icon: "🎯" },
  { value: "meeting", label: "Meeting", icon: "👥" },
  { value: "walk", label: "Spaziergang", icon: "🚶" },
  { value: "recreation", label: "Pause", icon: "☕" },
  { value: "eating", label: "Essen", icon: "🍽️" },
  { value: "note", label: "Notiz", icon: "📝" },
];

const TIMER_TYPES = new Set(["pomodoro", "meeting"]);

const BIZ_LEVELS = [
  { value: 1, label: "gering", icon: "◐" },
  { value: 2, label: "mittel", icon: "●" },
  { value: 3, label: "hoch", icon: "●●" },
  { value: 4, label: "sehr hoch", icon: "●●●" },
];

const ENERGY_LEVELS = [
  { value: -2, label: "drain", icon: "🔴🔴" },
  { value: -1, label: "müde", icon: "🔴" },
  { value: 0, label: "neutral", icon: "⚪" },
  { value: 1, label: "gut", icon: "🟢" },
  { value: 2, label: "Feuer", icon: "🟢🟢" },
];

const BIZ_MAP = { 1: "◐", 2: "●", 3: "●●", 4: "●●●" };
const ENERGY_MAP = { "-2": "🔴🔴", "-1": "🔴", "0": "⚪", "1": "🟢", "2": "🟢🟢" };
const TYPE_ICON = { pomodoro: "🎯", meeting: "👥", walk: "🚶", recreation: "☕", eating: "🍽️", note: "📝" };

// --- Timer persistence ---

const TIMER_KEY = "health-active-timer";
function saveTimer(data) {
  if (data) localStorage.setItem(TIMER_KEY, JSON.stringify(data));
  else localStorage.removeItem(TIMER_KEY);
}
function loadTimer() {
  try { return JSON.parse(localStorage.getItem(TIMER_KEY)); } catch { return null; }
}

// --- Timer Component (reused, extended with duration prop) ---

function PomodoroTimer({ duration = 1500, onComplete, soundEnabled = true, onTick, intention, timerKey }) {
  const saved = loadTimer();
  const isResume = saved && saved.key === timerKey;

  const [endTime, setEndTime] = useState(() => {
    if (isResume && saved.endTime && !saved.paused) return saved.endTime;
    return null;
  });
  const [pauseRemaining, setPauseRemaining] = useState(() => {
    if (isResume && saved.paused) return saved.pauseRemaining;
    return duration;
  });
  const [running, setRunning] = useState(() => isResume && !saved.paused && saved.endTime > Date.now());
  const [remaining, setRemaining] = useState(() => {
    if (isResume && saved.endTime && !saved.paused) return Math.max(0, Math.ceil((saved.endTime - Date.now()) / 1000));
    if (isResume && saved.paused) return saved.pauseRemaining;
    return duration;
  });
  const ref = useRef(null);
  const soundPlayed = useRef(false);

  useEffect(() => {
    if (running && endTime) {
      ref.current = setInterval(() => {
        const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        setRemaining(left);
        if (left <= 0) { clearInterval(ref.current); setRunning(false); saveTimer(null); }
      }, 250);
    }
    return () => clearInterval(ref.current);
  }, [running, endTime]);

  useEffect(() => { if (onTick) onTick(remaining, running); }, [remaining, running]);

  useEffect(() => {
    if (remaining > 0) {
      const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
      const ss = String(remaining % 60).padStart(2, "0");
      document.title = `${mm}:${ss} — ${intention || "Timer"} 🏛️`;
    } else if (remaining === 0 && intention) {
      document.title = `✓ ${intention} — 🏛️ Health System`;
    }
    return () => { document.title = "🏛️ Health System"; };
  }, [remaining, intention]);

  useEffect(() => {
    if (remaining === 0 && !soundPlayed.current && soundEnabled) {
      soundPlayed.current = true;
      playNotificationSound();
    }
  }, [remaining, soundEnabled]);

  const handleStart = () => {
    const left = pauseRemaining || duration;
    const et = Date.now() + left * 1000;
    setEndTime(et); setRunning(true); setPauseRemaining(0);
    saveTimer({ key: timerKey, endTime: et, paused: false, pauseRemaining: 0, intention });
  };

  const handlePause = () => {
    clearInterval(ref.current);
    const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    setRunning(false); setEndTime(null); setPauseRemaining(left); setRemaining(left);
    saveTimer({ key: timerKey, endTime: null, paused: true, pauseRemaining: left, intention });
  };

  const progress = 1 - remaining / duration;
  const done = remaining === 0;
  const r = 72, size = 180;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", padding: "0.3rem 0 0.8rem" }}>
      {intention && (
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.05rem", fontWeight: 700, textAlign: "center", lineHeight: 1.3, maxWidth: 280, padding: "0 0.5rem" }}>
          {intention}
        </div>
      )}
      <div style={{ position: "relative", width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth="5" opacity="0.4" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={done ? "var(--done)" : "var(--accent)"} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * r}`} strokeDashoffset={`${2 * Math.PI * r * (1 - progress)}`}
            transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 0.3s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "2.4rem", fontWeight: 700, color: done ? "var(--done)" : "var(--fg)" }}>
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
          </span>
          <span style={{ fontSize: "0.55rem", color: done ? "var(--done)" : "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
            {done ? "Geschafft!" : running ? "fokus" : "pausiert"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {!done && !running && <button onClick={handleStart} className="btn-interactive" style={btnStyle("var(--accent)", "#fff")}>{remaining === duration ? "Start" : "Weiter"}</button>}
        {!done && running && <button onClick={handlePause} className="btn-interactive" style={btnStyle("var(--muted)", "var(--fg)")}>Pause</button>}
        {done && <button onClick={onComplete} className="btn-interactive" style={btnStyle("var(--done)", "#fff")}>Fertig</button>}
      </div>
    </div>
  );
}

// --- Rating Component ---

function RatingStep({ intention, pomodoroId, onComplete }) {
  const [biz, setBiz] = useState(null);
  const [energy, setEnergy] = useState(null);

  const handleSubmit = async () => {
    if (biz == null || energy == null) return;
    await api.ratePomodoro(pomodoroId, biz, energy);
    onComplete();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.7rem", padding: "0.5rem 0" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 500, background: "var(--muted)", borderRadius: 6, padding: "0.3rem 0.6rem" }}>
        ✓ {intention}
      </div>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={labelStyle}>Geschäftswert</div>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {BIZ_LEVELS.map((lvl) => (
            <button key={lvl.value} onClick={() => setBiz(lvl.value)} className="chip-interactive" style={{
              flex: 1, padding: "0.4rem 0.2rem", borderRadius: 6, fontSize: "0.65rem", fontFamily: "inherit",
              border: biz === lvl.value ? "2px solid var(--accent)" : "1px solid var(--border)",
              background: biz === lvl.value ? "rgba(196,77,43,0.12)" : "transparent",
              color: biz === lvl.value ? "var(--accent)" : "var(--fg-dim)", cursor: "pointer",
              fontWeight: biz === lvl.value ? 700 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            }}>
              <span style={{ fontSize: "0.8rem" }}>{lvl.icon}</span><span>{lvl.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={labelStyle}>Energie-Bilanz</div>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {ENERGY_LEVELS.map((lvl) => (
            <button key={lvl.value} onClick={() => setEnergy(lvl.value)} className="chip-interactive" style={{
              flex: 1, padding: "0.4rem 0.2rem", borderRadius: 6, fontSize: "0.65rem", fontFamily: "inherit",
              border: energy === lvl.value ? "2px solid var(--done)" : "1px solid var(--border)",
              background: energy === lvl.value ? "rgba(45,138,78,0.12)" : "transparent",
              color: energy === lvl.value ? "var(--done)" : "var(--fg-dim)", cursor: "pointer",
              fontWeight: energy === lvl.value ? 700 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            }}>
              <span style={{ fontSize: "0.8rem" }}>{lvl.icon}</span><span>{lvl.label}</span>
            </button>
          ))}
        </div>
      </div>
      <button onClick={handleSubmit} className="btn-interactive" disabled={biz == null || energy == null} style={{
        ...btnStyle(biz != null && energy != null ? "var(--accent)" : "var(--muted)", biz != null && energy != null ? "#fff" : "var(--fg-dim)"),
        opacity: biz != null && energy != null ? 1 : 0.5, width: "100%", maxWidth: 340,
      }}>
        Bewertung speichern
      </button>
    </div>
  );
}

// --- Movement Component ---

function MovementPicker({ dayId, onComplete }) {
  const [timerDone, setTimerDone] = useState(false);
  const [secs, setSecs] = useState(60);
  const [running, setRunning] = useState(false);
  const [picks, setPicks] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    if (running && secs > 0) {
      ref.current = setInterval(() => {
        setSecs((s) => {
          if (s <= 1) { clearInterval(ref.current); setRunning(false); setTimerDone(true); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(ref.current);
  }, [running, secs]);

  const toggle = (id) => setPicks((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleConfirm = async () => {
    if (picks.length === 0) return;
    await api.createMovement(dayId, 0, "mini", picks.join(","), 60);
    onComplete();
  };

  return (
    <div style={{ padding: "0.5rem 0" }}>
      {!timerDone && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
          <div style={{ fontSize: "0.65rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            Mindestens 1 Minute bewegen
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.5rem", fontWeight: 700 }}>
            {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
          </span>
          <button onClick={() => setRunning(!running)} className="btn-interactive" style={btnStyle(running ? "var(--muted)" : "var(--accent)", running ? "var(--fg)" : "#fff", "0.78rem")}>
            {running ? "Pause" : secs === 60 ? "Los!" : "Weiter"}
          </button>
        </div>
      )}
      {timerDone && (
        <>
          <div style={{ fontSize: "0.65rem", color: "var(--done)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, textAlign: "center", marginBottom: "0.5rem" }}>
            Wähl deine Übung
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.3rem" }}>
            {QUICK_MOVES.map((m) => (
              <button key={m.id} onClick={() => toggle(m.id)} className="chip-interactive" style={{
                padding: "0.5rem", borderRadius: 8, fontSize: "0.68rem", fontFamily: "inherit",
                border: picks.includes(m.id) ? "2px solid var(--done)" : "1px solid var(--border)",
                background: picks.includes(m.id) ? "rgba(45,138,78,0.1)" : "var(--card-bg)",
                color: picks.includes(m.id) ? "var(--done)" : "var(--fg)", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem",
              }}>
                <span style={{ fontSize: "1.1rem" }}>{m.icon}</span>
                <span style={{ fontSize: "0.55rem" }}>{m.label}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", justifyContent: "center" }}>
            {picks.length > 0 && (
              <button onClick={handleConfirm} className="btn-interactive" style={btnStyle("var(--done)", "#fff", "0.78rem")}>
                ✓ Bewegung loggen
              </button>
            )}
            <button onClick={onComplete} style={{ background: "transparent", border: "none", fontSize: "0.65rem", color: "var(--fg-dim)", cursor: "pointer", fontFamily: "inherit" }}>
              Überspringen
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Tageslog (inline timeline) ---

function DayLog({ entries, movements }) {
  const completed = entries.filter((e) => e.completed_at);
  const fmtTime = (ts) => { try { return new Date(ts + "Z").toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  if (!completed.length && !movements.length) {
    return <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--fg-dim)", fontSize: "0.82rem", fontStyle: "italic" }}>Noch keine Einträge heute.</div>;
  }

  const totalMin = completed.reduce((s, e) => s + (e.duration_minutes || 25), 0);
  const totalBiz = completed.reduce((s, e) => s + (e.biz_rating || 0), 0);
  const count = completed.length;

  // Merge entries + movements into timeline
  const events = [
    ...completed.map((e) => ({ ...e, _type: "entry", _time: e.completed_at || e.started_at })),
    ...movements.map((m) => ({ ...m, _type: "move", _time: m.completed_at })),
  ].sort((a, b) => (a._time || "").localeCompare(b._time || ""));

  // Daily goal: 8 pomodoro-equivalents = 200 min
  const DAILY_GOAL = 200;
  const SLOTS = 8;
  const filledSlots = Math.min(SLOTS, Math.floor(totalMin / 25));
  const goalPct = Math.min(100, (totalMin / DAILY_GOAL) * 100);
  const goalReached = totalMin >= DAILY_GOAL;
  const bonusSlots = Math.max(0, Math.floor(totalMin / 25) - SLOTS);

  return (
    <div>
      {/* Daily progress bar */}
      <div style={{ marginBottom: "0.8rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 600, color: goalReached ? "var(--done)" : "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {goalReached ? "Tagesziel erreicht!" : "Tagesziel"}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", fontWeight: 700, color: goalReached ? "var(--done)" : "var(--accent)" }}>
            {totalMin} / {DAILY_GOAL} min
          </span>
        </div>
        {/* Segmented bar: 8 slots */}
        <div style={{ display: "flex", gap: 3, height: 12 }}>
          {Array.from({ length: SLOTS }, (_, i) => {
            const filled = i < filledSlots;
            const isNext = i === filledSlots;
            const partialPct = isNext ? ((totalMin % 25) / 25) * 100 : 0;
            return (
              <div key={i} style={{
                flex: 1, borderRadius: 3, background: "var(--border)", overflow: "hidden", position: "relative",
              }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  width: filled ? "100%" : isNext ? `${partialPct}%` : "0%",
                  background: goalReached ? "var(--done)" : "var(--accent)",
                  transition: "width 0.3s ease",
                }} />
              </div>
            );
          })}
        </div>
        {/* Bonus indicator */}
        {bonusSlots > 0 && (
          <div style={{ fontSize: "0.55rem", color: "var(--done)", fontWeight: 600, marginTop: "0.2rem", textAlign: "right" }}>
            +{bonusSlots} Bonus {bonusSlots === 1 ? "Einheit" : "Einheiten"}
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: "0.3rem", padding: "0.6rem 0.4rem", marginBottom: "0.8rem", background: "var(--muted)", borderRadius: 8 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.2rem", fontWeight: 700, color: "var(--accent)" }}>{totalMin}</div>
          <div style={{ fontSize: "0.55rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase" }}>Minuten</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.2rem", fontWeight: 700 }}>{count}</div>
          <div style={{ fontSize: "0.55rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase" }}>Einträge</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.2rem", fontWeight: 700, color: "var(--done)" }}>{movements.length}</div>
          <div style={{ fontSize: "0.55rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase" }}>Bewegung</div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: "relative", paddingLeft: "3rem" }}>
        <div style={{ position: "absolute", left: "2.4rem", top: 0, bottom: 0, width: 2, background: "var(--border)", borderRadius: 1 }} />
        {events.map((ev, i) => {
          if (ev._type === "entry") {
            const typeIcon = TYPE_ICON[ev.entry_type] || "🎯";
            return (
              <div key={`e-${i}`} style={{ position: "relative", marginBottom: "0.4rem" }}>
                <div style={{ position: "absolute", left: "-3rem", top: "0.25rem", width: "2.2rem", fontSize: "0.55rem", fontFamily: "'JetBrains Mono', monospace", color: "var(--fg-dim)", textAlign: "right" }}>
                  {fmtTime(ev._time)}
                </div>
                <div style={{ position: "absolute", left: "-0.85rem", top: "0.35rem", width: 10, height: 10, borderRadius: "50%", background: ev.completed_at ? "var(--accent)" : "var(--border)", border: "2px solid var(--bg)" }} />
                <div style={{ padding: "0.4rem 0.6rem", background: "var(--card-bg)", borderRadius: 6, borderLeft: `3px solid ${ev.project_color || "var(--border)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.15rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.7rem" }}>{typeIcon}</span>
                    <span style={{ fontSize: "0.55rem", fontFamily: "'JetBrains Mono', monospace", color: "var(--fg-dim)" }}>{ev.duration_minutes || 25}min</span>
                    {ev.project_name && (
                      <span style={{ fontSize: "0.5rem", background: `${ev.project_color || "var(--accent)"}20`, color: ev.project_color || "var(--accent)", borderRadius: 3, padding: "0.05rem 0.3rem", fontWeight: 700 }}>
                        {ev.project_name}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 500, lineHeight: 1.3 }}>{ev.intention}</div>
                  {ev.notes && <div style={{ fontSize: "0.6rem", color: "var(--fg-dim)", marginTop: "0.15rem", fontStyle: "italic" }}>{ev.notes}</div>}
                  {(ev.biz_rating != null || ev.energy_rating != null) && (
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.2rem", fontSize: "0.55rem" }}>
                      {ev.biz_rating != null && <span style={{ color: "var(--accent)" }}>{BIZ_MAP[ev.biz_rating]}</span>}
                      {ev.energy_rating != null && <span>{ENERGY_MAP[String(ev.energy_rating)]}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          }
          // Movement
          return (
            <div key={`m-${i}`} style={{ position: "relative", marginBottom: "0.3rem" }}>
              <div style={{ position: "absolute", left: "-3rem", top: "0.1rem", width: "2.2rem", fontSize: "0.52rem", fontFamily: "'JetBrains Mono', monospace", color: "var(--fg-dim)", textAlign: "right" }}>
                {fmtTime(ev._time)}
              </div>
              <div style={{ position: "absolute", left: "-0.7rem", top: "0.2rem", width: 6, height: 6, borderRadius: 2, background: "var(--done)" }} />
              <div style={{ fontSize: "0.65rem", color: "var(--done)", fontWeight: 500 }}>
                ↑ {(ev.exercise || "").split(",").join(" + ")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Todo List ---

function TodoList({ todos, dayId, openYesterday, onUpdate }) {
  const [newText, setNewText] = useState("");
  const [carriedIds, setCarriedIds] = useState(new Set());

  const handleAdd = async () => {
    if (!newText.trim()) return;
    await api.createTodo(dayId, newText.trim());
    setNewText("");
    onUpdate();
  };

  const handleToggle = async (id, currentDone) => {
    await api.toggleTodo(id, !currentDone);
    onUpdate();
  };

  const handleDelete = async (id) => {
    await api.deleteTodo(id);
    onUpdate();
  };

  const handleCarry = async (todo) => {
    await api.createTodo(dayId, todo.text, 0, todo.id);
    setCarriedIds((prev) => new Set([...prev, todo.id]));
    onUpdate();
  };

  const handleCarryAll = async () => {
    for (const t of openYesterday.filter((t) => !carriedIds.has(t.id))) {
      await api.createTodo(dayId, t.text, 0, t.id);
      setCarriedIds((prev) => new Set([...prev, t.id]));
    }
    onUpdate();
  };

  const uncollected = openYesterday.filter((t) => !carriedIds.has(t.id));

  return (
    <div>
      {/* Carry-over from yesterday */}
      {uncollected.length > 0 && (
        <div style={{ background: "rgba(196,77,43,0.08)", border: "1px solid var(--accent)", borderRadius: 8, padding: "0.6rem", marginBottom: "0.8rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--accent)", marginBottom: "0.4rem" }}>
            {uncollected.length} offene Aufgaben von gestern
          </div>
          {uncollected.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.25rem 0" }}>
              <span style={{ flex: 1, fontSize: "0.72rem" }}>{t.text}</span>
              <button onClick={() => handleCarry(t)} className="btn-interactive" style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 4, padding: "0.2rem 0.5rem", fontSize: "0.6rem", cursor: "pointer", fontFamily: "inherit" }}>
                Übernehmen
              </button>
            </div>
          ))}
          {uncollected.length > 1 && (
            <button onClick={handleCarryAll} className="btn-interactive" style={{ marginTop: "0.3rem", background: "transparent", border: "1px solid var(--accent)", borderRadius: 4, padding: "0.25rem 0.6rem", fontSize: "0.6rem", color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
              Alle übernehmen
            </button>
          )}
        </div>
      )}

      {/* Add todo */}
      <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.6rem" }}>
        <input value={newText} onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Neue Aufgabe..." style={{ ...inputStyle, fontSize: "0.78rem", flex: 1 }} />
        <button onClick={handleAdd} className="btn-interactive" disabled={!newText.trim()} style={{
          ...btnStyle(newText.trim() ? "var(--accent)" : "var(--muted)", newText.trim() ? "#fff" : "var(--fg-dim)", "0.78rem"),
          padding: "0.4rem 0.8rem", opacity: newText.trim() ? 1 : 0.5,
        }}>+</button>
      </div>

      {/* Todo items */}
      {todos.length === 0 && (
        <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--fg-dim)", fontSize: "0.78rem", fontStyle: "italic" }}>Keine Aufgaben.</div>
      )}
      {todos.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.3rem", borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => handleToggle(t.id, t.done)} style={{
            width: 22, height: 22, borderRadius: 4, border: `2px solid ${t.done ? "var(--done)" : "var(--border)"}`,
            background: t.done ? "var(--done)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: "0.65rem", flexShrink: 0,
          }}>
            {t.done ? "✓" : ""}
          </button>
          <span style={{
            flex: 1, fontSize: "0.78rem", textDecoration: t.done ? "line-through" : "none",
            color: t.done ? "var(--fg-dim)" : "var(--fg)",
          }}>
            {t.text}
            {t.carried_from_id && <span style={{ fontSize: "0.55rem", color: "var(--fg-dim)", marginLeft: "0.3rem" }}>(gestern)</span>}
          </span>
          <button onClick={() => handleDelete(t.id)} style={{
            background: "transparent", border: "none", color: "var(--fg-dim)", cursor: "pointer",
            fontSize: "0.7rem", padding: "0.2rem", opacity: 0.5,
          }}>×</button>
        </div>
      ))}
    </div>
  );
}

// --- Main Component ---

export default function HealthTracker({ theme, settings, onSettingsChange }) {
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gamification, setGamification] = useState(null);
  const [projects, setProjects] = useState([]);
  const [timerInfo, setTimerInfo] = useState(null);

  // Entry flow state
  const [phase, setPhase] = useState("idle"); // idle, configuring, timer, rating, movement
  const [entryConfig, setEntryConfig] = useState({
    intention: "", entryType: "pomodoro", duration: 25, projectId: null, tags: [], notes: "",
  });
  const [currentEntryId, setCurrentEntryId] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Mobile tab
  const [mobileTab, setMobileTab] = useState("timer");

  const loadData = useCallback(async () => {
    try {
      const [data, gamHistory, projs] = await Promise.all([
        api.getToday(),
        api.getGamificationHistory(7),
        api.getProjects(),
      ]);
      setDayData(data);
      setGamification({
        current: data.gamification || { current_rank: 1, streak_length: 0, cumulative_xp: 0 },
        history: gamHistory || [],
      });
      setProjects(projs || []);
    } catch (e) { console.error("Failed to load:", e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Persist gamification
  const prevGamKey = useRef("");
  useEffect(() => {
    if (!dayData?.day?.id) return;
    const entries = dayData.pomodoros || [];
    const moves = dayData.movements || [];
    const { dayXP, totalMinutes } = calcDayXPFlex(entries, moves.length);
    const sl = dayData.streakLength || 0;
    const effXP = calcEffectiveXP(dayXP, sl);
    const cumXP = (gamification?.current?.cumulative_xp || 0) + effXP - (dayData.day.effective_xp || 0);
    const lp = getLevelProgress(cumXP);
    const key = `${entries.length}-${moves.length}-${dayXP}`;
    if (key === prevGamKey.current) return;
    prevGamKey.current = key;
    if (entries.filter((e) => e.completed_at).length === 0 && moves.length === 0) return;
    api.updateDayPoints(dayData.day.id, entries.length, dayXP, effXP, sl, lp.level).catch(() => {});
    api.upsertGamification({
      date: dayData.day.date, cumulative_points: entries.length, cumulative_xp: cumXP,
      current_rank: lp.level, streak_length: sl, level_change: "none",
    }).catch(() => {});
  }, [dayData, gamification]);

  if (loading || !dayData) return <div style={{ padding: "2rem", textAlign: "center" }}>Laden...</div>;

  // Compute stats
  const entries = dayData.pomodoros || [];
  const movements = dayData.movements || [];
  const { dayXP, totalMinutes } = calcDayXPFlex(entries, movements.length);
  const streak = dayData.streakLength || 0;
  const effectiveXP = calcEffectiveXP(dayXP, streak);
  const cumulativeXP = (gamification?.current?.cumulative_xp || 0) + effectiveXP - (dayData.day.effective_xp || 0);
  const levelProgress = getLevelProgress(cumulativeXP);
  const rank = getRank(levelProgress.level);
  const streakMult = getStreakMultiplier(streak);

  // Late night warning
  const now = new Date();
  const isLate = now.getHours() > 22 || (now.getHours() === 22 && now.getMinutes() >= 30);

  // --- Action Handlers ---

  const handleStartEntry = async () => {
    if (!entryConfig.intention.trim()) return;
    const type = entryConfig.entryType;
    const dur = entryConfig.duration;

    const { id } = await api.createEntry(dayData.day.id, entryConfig.intention.trim(), {
      entryType: type, durationMinutes: dur, projectId: entryConfig.projectId,
      valueTags: entryConfig.tags, notes: entryConfig.notes,
    });
    setCurrentEntryId(id);

    if (TIMER_TYPES.has(type)) {
      setPhase("timer");
    } else {
      // No timer needed — complete immediately
      await api.completePomodoro(id);
      await loadData();
      setPhase("idle");
      resetConfig();
    }
  };

  const handleTimerComplete = async () => {
    if (currentEntryId) await api.completePomodoro(currentEntryId);
    await loadData();
    setPhase("rating");
  };

  const handleRatingComplete = async () => {
    await loadData();
    setPhase("movement");
  };

  const handleMovementComplete = async () => {
    await loadData();
    setPhase("idle");
    resetConfig();
  };

  const handleSkipMovement = async () => {
    await loadData();
    setPhase("idle");
    resetConfig();
  };

  const resetConfig = () => {
    setEntryConfig({ intention: "", entryType: "pomodoro", duration: 25, projectId: null, tags: [], notes: "" });
    setCurrentEntryId(null);
    setShowDetails(false);
  };

  // --- Render ---

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 640;

  const renderTimerPanel = () => (
    <div>
      {/* Late night banner */}
      {isLate && (
        <div style={{ background: "var(--accent)", color: "#fff", padding: "0.5rem 0.8rem", borderRadius: 8, marginBottom: "0.8rem", fontSize: "0.72rem", fontWeight: 600, textAlign: "center" }}>
          Die Stunden vor Mitternacht sind doppelt so viel wert.
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
        <div>
          <div style={{ fontSize: "0.68rem", color: "var(--fg-dim)" }}>
            {now.toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "0.85rem", fontWeight: 700, marginTop: "0.1rem" }}>
            {rank.name} <span style={{ fontSize: "0.65rem", color: "var(--fg-dim)", fontWeight: 400 }}>{rank.title}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1rem", fontWeight: 700, color: "var(--accent)" }}>{effectiveXP}</div>
            <div style={{ fontSize: "0.5rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase" }}>XP</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1rem", fontWeight: 700, color: "var(--done)" }}>{totalMinutes}</div>
            <div style={{ fontSize: "0.5rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase" }}>min</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1rem", fontWeight: 700, color: streak > 0 ? "var(--done)" : "var(--fg-dim)" }}>{streak}</div>
            <div style={{ fontSize: "0.5rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase" }}>Streak</div>
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.55rem", color: "var(--fg-dim)", marginBottom: "0.15rem" }}>
          <span>Level {levelProgress.level}</span>
          <span>{Math.round(levelProgress.progress * 100)}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${levelProgress.progress * 100}%`, background: "var(--accent)", borderRadius: 2, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* PHASE: Idle / Configuring */}
      {(phase === "idle" || phase === "configuring") && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {/* Entry Type */}
          <div>
            <div style={labelStyle}>Typ</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
              {ENTRY_TYPES.map((t) => (
                <button key={t.value} onClick={() => {
                  setEntryConfig((c) => ({
                    ...c, entryType: t.value,
                    duration: t.value === "meeting" ? 60 : t.value === "walk" ? 10 : t.value === "note" || t.value === "eating" ? 5 : 25,
                  }));
                  setPhase("configuring");
                }} className="chip-interactive" style={chipStyle(entryConfig.entryType === t.value)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Intention */}
          <div>
            <div style={labelStyle}>Was?</div>
            <input value={entryConfig.intention} onChange={(e) => { setEntryConfig((c) => ({ ...c, intention: e.target.value })); setPhase("configuring"); }}
              onKeyDown={(e) => e.key === "Enter" && entryConfig.intention.trim() && handleStartEntry()}
              placeholder={entryConfig.entryType === "note" ? "Notiz..." : entryConfig.entryType === "eating" ? "Was gegessen?" : "Woran arbeitest du?"}
              style={inputStyle} autoFocus />
          </div>

          {/* Duration */}
          <div>
            <div style={labelStyle}>Dauer</div>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {DURATION_OPTIONS.map((d) => (
                <button key={d.value} onClick={() => setEntryConfig((c) => ({ ...c, duration: d.value }))} className="chip-interactive"
                  style={{ ...chipStyle(entryConfig.duration === d.value), flex: 1, textAlign: "center", padding: "0.4rem 0.3rem" }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Project + Details */}
          {entryConfig.intention.trim() && (
            <>
              {/* Project — always visible */}
              {projects.length > 0 && (
                <div>
                  <div style={labelStyle}>Projekt</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                    {projects.map((p) => (
                      <button key={p.id} onClick={() => setEntryConfig((c) => ({ ...c, projectId: c.projectId === p.id ? null : p.id }))} className="chip-interactive"
                        style={chipStyle(entryConfig.projectId === p.id, p.color)}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags + Notes — expandable */}
              {!showDetails && (
                <button onClick={() => setShowDetails(true)} style={{ background: "transparent", border: "none", fontSize: "0.65rem", color: "var(--fg-dim)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  + Tags, Notiz
                </button>
              )}
              {showDetails && (
                <>
                  <div>
                    <div style={labelStyle}>Wert-Kategorie</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                      {VALUE_TAGS.map((tag) => (
                        <button key={tag.id} onClick={() => setEntryConfig((c) => ({
                          ...c, tags: c.tags.includes(tag.id) ? c.tags.filter((t) => t !== tag.id) : [...c.tags, tag.id],
                        }))} className="chip-interactive" style={chipStyle(entryConfig.tags.includes(tag.id), tag.color)}>
                          {tag.icon} {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>Notiz</div>
                    <input value={entryConfig.notes} onChange={(e) => setEntryConfig((c) => ({ ...c, notes: e.target.value }))}
                      placeholder="Optional..." style={{ ...inputStyle, fontSize: "0.78rem" }} />
                  </div>
                </>
              )}

              {/* Start Button */}
              <button onClick={handleStartEntry} className="btn-interactive" style={{
                ...btnStyle("var(--accent)", "#fff"), width: "100%", marginTop: "0.3rem",
              }}>
                {TIMER_TYPES.has(entryConfig.entryType) ? `Timer starten (${entryConfig.duration} min)` : "Eintrag loggen"}
              </button>
            </>
          )}
        </div>
      )}

      {/* PHASE: Timer */}
      {phase === "timer" && (
        <PomodoroTimer
          duration={entryConfig.duration * 60}
          onComplete={handleTimerComplete}
          soundEnabled={settings?.soundEnabled}
          onTick={(secs, running) => setTimerInfo({ seconds: secs, running, intention: entryConfig.intention })}
          intention={entryConfig.intention}
          timerKey={`entry-${currentEntryId}`}
        />
      )}

      {/* PHASE: Rating */}
      {phase === "rating" && currentEntryId && (
        <RatingStep intention={entryConfig.intention} pomodoroId={currentEntryId} onComplete={handleRatingComplete} />
      )}

      {/* PHASE: Movement */}
      {phase === "movement" && (
        <div>
          <div style={{ textAlign: "center", marginBottom: "0.3rem", fontSize: "0.72rem", fontWeight: 600 }}>Bewegungspause</div>
          <MovementPicker dayId={dayData.day.id} onComplete={handleMovementComplete} />
          <div style={{ textAlign: "center", marginTop: "0.3rem" }}>
            <button onClick={handleSkipMovement} style={{ background: "transparent", border: "none", fontSize: "0.65rem", color: "var(--fg-dim)", cursor: "pointer", fontFamily: "inherit" }}>
              Überspringen
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderLogPanel = () => (
    <DayLog entries={entries} movements={movements} />
  );

  const renderTodosPanel = () => (
    <TodoList todos={dayData.todos || []} dayId={dayData.day.id} openYesterday={dayData.openTodosYesterday || []} onUpdate={loadData} />
  );

  const tabs = [
    { id: "timer", label: "Timer" },
    { id: "log", label: `Log (${entries.filter((e) => e.completed_at).length})` },
    { id: "todos", label: `Todos (${(dayData.todos || []).filter((t) => !t.done).length})` },
  ];

  return (
    <div style={{ ...pageStyle(theme), maxWidth: isDesktop ? 800 : 480 }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet" />

      {/* Mobile: Tabs */}
      {!isDesktop && (
        <>
          <div style={{ display: "flex", gap: "0.2rem", marginBottom: "1rem", background: "var(--muted)", borderRadius: 8, padding: "0.2rem" }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setMobileTab(t.id)} className="btn-interactive" style={{
                flex: 1, padding: "0.4rem 0.2rem", borderRadius: 6, fontSize: "0.65rem", fontWeight: 600,
                fontFamily: "inherit", cursor: "pointer", border: "none",
                background: mobileTab === t.id ? "var(--card-bg)" : "transparent",
                color: mobileTab === t.id ? "var(--accent)" : "var(--fg-dim)",
              }}>
                {t.label}
              </button>
            ))}
          </div>
          {mobileTab === "timer" && renderTimerPanel()}
          {mobileTab === "log" && renderLogPanel()}
          {mobileTab === "todos" && renderTodosPanel()}
        </>
      )}

      {/* Desktop: 2 columns */}
      {isDesktop && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem" }}>
          <div>{renderTimerPanel()}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Tageslog</h3>
              {renderLogPanel()}
            </div>
            <div>
              <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Todos</h3>
              {renderTodosPanel()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
