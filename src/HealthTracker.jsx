import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api.js";
import { getRank, calcDayXP, calcEffectiveXP, getStreakMultiplier, dayCountsForStreak, getLevelFromXP, getLevelProgress, xpForLevel } from "./gamification.js";
import { playNotificationSound } from "./useSettings.js";
import { VALUE_TAGS, CATEGORY_COLORS, btnStyle, chipStyle, inputStyle, pageStyle } from "./constants.js";

const QUICK_MOVES = [
  { id: "pushups", label: "Liegestütze", icon: "💪" },
  { id: "pullups", label: "Klimmzüge", icon: "🏋️" },
  { id: "squats", label: "Kniebeugen", icon: "🦵" },
  { id: "plank", label: "Plank", icon: "🧱" },
  { id: "stretch", label: "Dehnen", icon: "🧘" },
  { id: "rope", label: "Seilspringen", icon: "🪢" },
];

const BLOCK_MOVES = [
  { id: "walk", label: "Spaziergang (15 min)", icon: "🚶" },
  { id: "rope_long", label: "Seilspringen (10 min)", icon: "🪢" },
  { id: "workout", label: "Liegestütze + Klimmzüge Set", icon: "💪" },
  { id: "mobility", label: "Mobility Routine", icon: "🧘" },
];

const BLOCK_LABELS = ["I", "II", "III", "IV"];


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

const GAP_THRESHOLD_MIN = 30;

function parseValueTags(raw) {
  if (!raw) return [];
  return raw.split(",").filter(Boolean);
}

function GapAudit({ gapMinutes, lastTime, dayId, projects, onComplete }) {
  const pomCount = Math.floor(gapMinutes / 25);
  const [mode, setMode] = useState("quick"); // "quick" or "granular"
  const [intention, setIntention] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [biz, setBiz] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [entries, setEntries] = useState(() =>
    Array.from({ length: pomCount }, (_, i) => ({ intention: "", project: null, biz: null, energy: null }))
  );
  const [submitting, setSubmitting] = useState(false);

  const hours = Math.floor(gapMinutes / 60);
  const mins = gapMinutes % 60;
  const gapLabel = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;

  const handleSubmitQuick = async () => {
    if (!intention.trim() || biz == null || energy == null) return;
    setSubmitting(true);
    const lastDate = new Date(lastTime + "Z");
    const retros = Array.from({ length: pomCount }, (_, i) => {
      const start = new Date(lastDate.getTime() + i * 25 * 60 * 1000);
      const end = new Date(start.getTime() + 25 * 60 * 1000);
      return {
        day_id: dayId, block_index: 0, pom_index: 0,
        intention: intention.trim(), project_id: selectedProject,
        biz_rating: biz, energy_rating: energy, value_tags: [],
        started_at: start.toISOString().replace("T", " ").slice(0, 19),
        completed_at: end.toISOString().replace("T", " ").slice(0, 19),
      };
    });
    await api.createRetroPomodoros(retros);
    setSubmitting(false);
    onComplete();
  };

  const handleSubmitGranular = async () => {
    const valid = entries.every((e) => e.intention.trim() && e.biz != null && e.energy != null);
    if (!valid) return;
    setSubmitting(true);
    const lastDate = new Date(lastTime + "Z");
    const retros = entries.map((e, i) => {
      const start = new Date(lastDate.getTime() + i * 25 * 60 * 1000);
      const end = new Date(start.getTime() + 25 * 60 * 1000);
      return {
        day_id: dayId, block_index: 0, pom_index: 0,
        intention: e.intention.trim(), project_id: e.project,
        biz_rating: e.biz, energy_rating: e.energy, value_tags: [],
        started_at: start.toISOString().replace("T", " ").slice(0, 19),
        completed_at: end.toISOString().replace("T", " ").slice(0, 19),
      };
    });
    await api.createRetroPomodoros(retros);
    setSubmitting(false);
    onComplete();
  };

  const updateEntry = (idx, patch) => {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  };

  const canSubmitQuick = intention.trim() && biz != null && energy != null;
  const canSubmitGranular = entries.every((e) => e.intention.trim() && e.biz != null && e.energy != null);

  return (
    <div style={{
      border: "2px solid var(--accent)", borderRadius: 12, padding: "1rem",
      background: "var(--card-bg)", marginBottom: "1rem",
    }}>
      <div style={{ textAlign: "center", marginBottom: "0.8rem" }}>
        <div style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Lücke erkannt
        </div>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.2rem", fontWeight: 700, margin: "0.2rem 0" }}>
          {gapLabel} ungeloggt
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--fg-dim)" }}>
          Das sind ~{pomCount} Pomodoro{pomCount !== 1 ? "s" : ""}. Was hast du gemacht?
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.8rem" }}>
        <button onClick={() => setMode("quick")} style={{
          flex: 1, padding: "0.35rem", borderRadius: 6, fontSize: "0.68rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
          border: mode === "quick" ? "2px solid var(--accent)" : "1px solid var(--border)",
          background: mode === "quick" ? "rgba(196,77,43,0.08)" : "transparent",
          color: mode === "quick" ? "var(--accent)" : "var(--fg-dim)",
        }}>
          Alle gleich
        </button>
        <button onClick={() => setMode("granular")} style={{
          flex: 1, padding: "0.35rem", borderRadius: 6, fontSize: "0.68rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
          border: mode === "granular" ? "2px solid var(--accent)" : "1px solid var(--border)",
          background: mode === "granular" ? "rgba(196,77,43,0.08)" : "transparent",
          color: mode === "granular" ? "var(--accent)" : "var(--fg-dim)",
        }}>
          Einzeln aufteilen
        </button>
      </div>

      {mode === "quick" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Project */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem" }}>
            {projects.map((p) => (
              <button key={p.id} onClick={() => setSelectedProject(selectedProject === p.id ? null : p.id)} style={{
                padding: "0.2rem 0.4rem", borderRadius: 4, fontSize: "0.6rem", fontFamily: "inherit", cursor: "pointer",
                border: selectedProject === p.id ? `2px solid ${p.color}` : "1px solid var(--border)",
                background: selectedProject === p.id ? `${p.color}18` : "transparent",
                color: selectedProject === p.id ? p.color : "var(--fg-dim)", fontWeight: selectedProject === p.id ? 700 : 400,
              }}>{p.name}</button>
            ))}
          </div>
          <input value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="Was hast du gemacht?"
            style={{ width: "100%", padding: "0.5rem 0.7rem", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.8rem", fontFamily: "inherit", background: "var(--bg)", color: "var(--fg)" }} />
          {/* Biz rating */}
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {BIZ_LEVELS.map((lvl) => (
              <button key={lvl.value} onClick={() => setBiz(lvl.value)} style={{
                flex: 1, padding: "0.3rem", borderRadius: 5, fontSize: "0.6rem", fontFamily: "inherit", cursor: "pointer",
                border: biz === lvl.value ? "2px solid var(--accent)" : "1px solid var(--border)",
                background: biz === lvl.value ? "rgba(196,77,43,0.1)" : "transparent",
                color: biz === lvl.value ? "var(--accent)" : "var(--fg-dim)", fontWeight: biz === lvl.value ? 700 : 400,
                display: "flex", flexDirection: "column", alignItems: "center", gap: "1px",
              }}><span>{lvl.icon}</span><span>{lvl.label}</span></button>
            ))}
          </div>
          {/* Energy */}
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {ENERGY_LEVELS.map((lvl) => (
              <button key={lvl.value} onClick={() => setEnergy(lvl.value)} style={{
                flex: 1, padding: "0.3rem", borderRadius: 5, fontSize: "0.6rem", fontFamily: "inherit", cursor: "pointer",
                border: energy === lvl.value ? "2px solid var(--done)" : "1px solid var(--border)",
                background: energy === lvl.value ? "rgba(45,138,78,0.1)" : "transparent",
                color: energy === lvl.value ? "var(--done)" : "var(--fg-dim)", fontWeight: energy === lvl.value ? 700 : 400,
                display: "flex", flexDirection: "column", alignItems: "center", gap: "1px",
              }}><span>{lvl.icon}</span><span>{lvl.label}</span></button>
            ))}
          </div>
          <button onClick={handleSubmitQuick} disabled={!canSubmitQuick || submitting} style={{
            ...btnStyle(canSubmitQuick ? "var(--accent)" : "var(--muted)", canSubmitQuick ? "#fff" : "var(--fg-dim)", "0.78rem"),
            opacity: canSubmitQuick ? 1 : 0.5, width: "100%",
          }}>
            {pomCount} Retro-Pomodoro{pomCount !== 1 ? "s" : ""} loggen →
          </button>
        </div>
      )}

      {mode === "granular" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {entries.map((e, i) => (
            <div key={i} style={{ padding: "0.5rem", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }}>
              <div style={{ fontSize: "0.6rem", color: "var(--fg-dim)", fontWeight: 600, marginBottom: "0.3rem" }}>
                Pomodoro {i + 1}/{pomCount}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem", marginBottom: "0.3rem" }}>
                {projects.map((p) => (
                  <button key={p.id} onClick={() => updateEntry(i, { project: e.project === p.id ? null : p.id })} style={{
                    padding: "0.15rem 0.35rem", borderRadius: 3, fontSize: "0.55rem", fontFamily: "inherit", cursor: "pointer",
                    border: e.project === p.id ? `2px solid ${p.color}` : "1px solid var(--border)",
                    background: e.project === p.id ? `${p.color}18` : "transparent",
                    color: e.project === p.id ? p.color : "var(--fg-dim)",
                  }}>{p.name}</button>
                ))}
              </div>
              <input value={e.intention} onChange={(ev) => updateEntry(i, { intention: ev.target.value })} placeholder="Was?"
                style={{ width: "100%", padding: "0.35rem 0.5rem", border: "1px solid var(--border)", borderRadius: 5, fontSize: "0.72rem", fontFamily: "inherit", background: "var(--card-bg)", color: "var(--fg)", marginBottom: "0.3rem" }} />
              <div style={{ display: "flex", gap: "0.2rem", marginBottom: "0.2rem" }}>
                {BIZ_LEVELS.map((lvl) => (
                  <button key={lvl.value} onClick={() => updateEntry(i, { biz: lvl.value })} style={{
                    flex: 1, padding: "0.2rem", borderRadius: 4, fontSize: "0.5rem", fontFamily: "inherit", cursor: "pointer",
                    border: e.biz === lvl.value ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: e.biz === lvl.value ? "rgba(196,77,43,0.1)" : "transparent",
                    color: e.biz === lvl.value ? "var(--accent)" : "var(--fg-dim)",
                  }}>{lvl.icon}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.2rem" }}>
                {ENERGY_LEVELS.map((lvl) => (
                  <button key={lvl.value} onClick={() => updateEntry(i, { energy: lvl.value })} style={{
                    flex: 1, padding: "0.2rem", borderRadius: 4, fontSize: "0.5rem", fontFamily: "inherit", cursor: "pointer",
                    border: e.energy === lvl.value ? "2px solid var(--done)" : "1px solid var(--border)",
                    background: e.energy === lvl.value ? "rgba(45,138,78,0.1)" : "transparent",
                    color: e.energy === lvl.value ? "var(--done)" : "var(--fg-dim)",
                  }}>{lvl.icon}</button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={handleSubmitGranular} disabled={!canSubmitGranular || submitting} style={{
            ...btnStyle(canSubmitGranular ? "var(--accent)" : "var(--muted)", canSubmitGranular ? "#fff" : "var(--fg-dim)", "0.78rem"),
            opacity: canSubmitGranular ? 1 : 0.5, width: "100%",
          }}>
            {pomCount} Retro-Pomodoros loggen →
          </button>
        </div>
      )}

      {/* Skip option */}
      <button onClick={onComplete} style={{
        background: "transparent", border: "none", fontSize: "0.65rem", color: "var(--fg-dim)",
        cursor: "pointer", fontFamily: "inherit", marginTop: "0.5rem", width: "100%", textAlign: "center",
      }}>
        Überspringen
      </button>
    </div>
  );
}

// Rebuild block state from DB records
function buildBlocksFromDB(pomodoros, movements) {
  const blocks = Array.from({ length: 4 }, () => ({
    pomodoros: [false, false, false, false],
    intentions: [null, null, null, null],
    valueTags: [[], [], [], []],
    pomodoroIds: [null, null, null, null],
    bizRatings: [null, null, null, null],
    energyRatings: [null, null, null, null],
    projectIds: [null, null, null, null],
    projectNames: [null, null, null, null],
    projectColors: [null, null, null, null],
    miniMoves: [null, null, null, null],
    blockMove: null,
  }));

  for (const p of pomodoros) {
    const b = blocks[p.block_index];
    if (b) {
      b.intentions[p.pom_index] = p.intention;
      b.valueTags[p.pom_index] = parseValueTags(p.value_tags);
      b.pomodoroIds[p.pom_index] = p.id;
      b.bizRatings[p.pom_index] = p.biz_rating;
      b.energyRatings[p.pom_index] = p.energy_rating;
      b.projectIds[p.pom_index] = p.project_id;
      b.projectNames[p.pom_index] = p.project_name || null;
      b.projectColors[p.pom_index] = p.project_color || null;
      if (p.completed_at) b.pomodoros[p.pom_index] = true;
    }
  }

  for (const m of movements) {
    const b = blocks[m.block_index];
    if (!b) continue;
    if (m.type === "mini") {
      const slot = b.miniMoves.findIndex((v) => !v);
      if (slot !== -1) b.miniMoves[slot] = m.exercise;
    } else {
      b.blockMove = m.exercise;
    }
  }

  return blocks;
}

// New flow: [Pom → Rating → MiniMove] ×4 → BlockPause
function getBlockStep(block) {
  for (let i = 0; i < 4; i++) {
    if (!block.pomodoros[i]) return { type: "pomodoro", index: i };
    if (block.bizRatings[i] == null) return { type: "rating", index: i };
    if (!block.miniMoves[i]) return { type: "miniMove", index: i };
  }
  if (!block.blockMove) return { type: "blockMove" };
  return { type: "done" };
}

function isBlockComplete(block) {
  return getBlockStep(block).type === "done";
}

function TimerDisplay({ seconds, size = "3rem" }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: size, fontWeight: 700, letterSpacing: "0.04em", color: "var(--fg)" }}>
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

const TIMER_KEY = "health-active-timer";
const WORK = 25 * 60;

function saveTimer(data) {
  if (data) localStorage.setItem(TIMER_KEY, JSON.stringify(data));
  else localStorage.removeItem(TIMER_KEY);
}

function loadTimer() {
  try { return JSON.parse(localStorage.getItem(TIMER_KEY)); } catch { return null; }
}

function PomodoroTimer({ onComplete, autoStart = false, soundEnabled = true, onTick, intention, timerKey }) {
  const saved = loadTimer();
  const isResume = saved && saved.key === timerKey;

  const [endTime, setEndTime] = useState(() => {
    if (isResume && saved.endTime && !saved.paused) return saved.endTime;
    if (isResume && saved.paused) return null;
    return null;
  });
  const [pauseRemaining, setPauseRemaining] = useState(() => {
    if (isResume && saved.paused) return saved.pauseRemaining;
    return WORK;
  });
  const [running, setRunning] = useState(() => isResume && !saved.paused && saved.endTime > Date.now());
  const [remaining, setRemaining] = useState(() => {
    if (isResume && saved.endTime && !saved.paused) return Math.max(0, Math.ceil((saved.endTime - Date.now()) / 1000));
    if (isResume && saved.paused) return saved.pauseRemaining;
    return WORK;
  });
  const ref = useRef(null);
  const soundPlayed = useRef(false);

  // Auto-start on mount if requested and not resuming
  useEffect(() => {
    if (autoStart && !isResume && !endTime) {
      const et = Date.now() + WORK * 1000;
      setEndTime(et);
      setRunning(true);
      saveTimer({ key: timerKey, endTime: et, paused: false, pauseRemaining: 0, intention });
    }
  }, []);

  // Tick: compute remaining from endTime
  useEffect(() => {
    if (running && endTime) {
      ref.current = setInterval(() => {
        const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        setRemaining(left);
        if (left <= 0) {
          clearInterval(ref.current);
          setRunning(false);
          saveTimer(null);
        }
      }, 250);
    }
    return () => clearInterval(ref.current);
  }, [running, endTime]);

  useEffect(() => {
    if (onTick) onTick(remaining, running);
  }, [remaining, running]);

  // Browser tab title
  useEffect(() => {
    if (remaining > 0) {
      const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
      const ss = String(remaining % 60).padStart(2, "0");
      document.title = `${mm}:${ss} — ${intention || "Pomodoro"} 🏛️`;
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
    const left = pauseRemaining || WORK;
    const et = Date.now() + left * 1000;
    setEndTime(et);
    setRunning(true);
    setPauseRemaining(0);
    saveTimer({ key: timerKey, endTime: et, paused: false, pauseRemaining: 0, intention });
  };

  const handlePause = () => {
    clearInterval(ref.current);
    const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    setRunning(false);
    setEndTime(null);
    setPauseRemaining(left);
    setRemaining(left);
    saveTimer({ key: timerKey, endTime: null, paused: true, pauseRemaining: left, intention });
  };


  const progress = 1 - remaining / WORK;
  const done = remaining === 0;
  const r = 82;
  const size = 200;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem", padding: "0.5rem 0 1rem" }}>
      {intention && (
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "1.15rem", fontWeight: 700, color: "var(--fg)",
          textAlign: "center", lineHeight: 1.3, maxWidth: 300,
          padding: "0 0.5rem",
        }}>
          {intention}
        </div>
      )}

      <div style={{ position: "relative", width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth="6" opacity="0.4" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={done ? "var(--done)" : "var(--accent)"} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * r}`} strokeDashoffset={`${2 * Math.PI * r * (1 - progress)}`}
            transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 0.3s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{
            fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
            fontSize: "2.8rem", fontWeight: 700, letterSpacing: "0.02em",
            color: done ? "var(--done)" : "var(--fg)",
          }}>
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
          </span>
          {!done && (
            <span style={{ fontSize: "0.6rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "0.1rem" }}>
              {running ? "fokus" : "pausiert"}
            </span>
          )}
          {done && (
            <span style={{ fontSize: "0.7rem", color: "var(--done)", fontWeight: 600, marginTop: "0.1rem" }}>
              Geschafft!
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.6rem" }}>
        {!done && !running && (
          <button onClick={handleStart} className="btn-interactive" style={btnStyle("var(--accent)", "#fff")}>
            {remaining === WORK ? "Start" : "Weiter"}
          </button>
        )}
        {!done && running && (
          <button onClick={handlePause} className="btn-interactive" style={btnStyle("var(--muted)", "var(--fg)")}>Pause</button>
        )}
        {done && (
          <button onClick={onComplete} className="btn-interactive" style={btnStyle("var(--done)", "#fff")}>✓ Fertig</button>
        )}
      </div>
    </div>
  );
}

function MoveCountdown({ onFinished }) {
  const [secs, setSecs] = useState(60);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (running && secs > 0) {
      ref.current = setInterval(() => {
        setSecs((s) => {
          if (s <= 1) { clearInterval(ref.current); setRunning(false); setFinished(true); onFinished(); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(ref.current);
  }, [running, secs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ fontSize: "0.7rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
        {finished ? "✓ Mindestzeit erreicht — wähl deine Übung" : "Mindestens 1 Minute bewegen"}
      </div>
      {!finished && <TimerDisplay seconds={secs} size="1.8rem" />}
      {!finished && (
        <button onClick={() => setRunning(!running)} className="btn-interactive" style={btnStyle(running ? "var(--muted)" : "var(--accent)", running ? "var(--fg)" : "#fff", "0.8rem")}>
          {running ? "Pause" : secs === 60 ? "Los!" : "Weiter"}
        </button>
      )}
    </div>
  );
}

function QuickMovePicker({ onConfirm, selected }) {
  const [timerDone, setTimerDone] = useState(false);
  const [picks, setPicks] = useState([]);
  const alreadyDone = !!selected;

  const toggle = (id) => setPicks((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const selectedSet = alreadyDone ? (selected || "").split(",") : picks;

  return (
    <div style={{ padding: "0.5rem 0" }}>
      {!timerDone && !alreadyDone && <MoveCountdown onFinished={() => setTimerDone(true)} />}
      {(timerDone || alreadyDone) && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", marginTop: "0.5rem" }}>
            {QUICK_MOVES.map((m) => {
              const active = selectedSet.includes(m.id);
              return (
                <button key={m.id} onClick={() => !alreadyDone && toggle(m.id)} className={alreadyDone ? "" : "chip-interactive"} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem",
                  padding: "0.45rem 0.2rem", border: active ? "2px solid var(--done)" : "1px solid var(--border)",
                  borderRadius: 8, background: active ? "var(--done-bg)" : "var(--card-bg)",
                  cursor: alreadyDone ? "default" : "pointer", fontSize: "0.72rem", fontFamily: "inherit", color: "var(--fg)",
                  fontWeight: active ? 600 : 400,
                }}>
                  <span style={{ fontSize: "1rem" }}>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
          {!alreadyDone && picks.length > 0 && (
            <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
              <button onClick={() => onConfirm(picks.join(","))} className="btn-interactive" style={btnStyle("var(--done)", "#fff", "0.78rem")}>
                ✓ {picks.length} Übung{picks.length !== 1 ? "en" : ""} loggen
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BlockMovePicker({ onConfirm, selected }) {
  const [picks, setPicks] = useState([]);
  const alreadyDone = !!selected;

  const toggle = (id) => setPicks((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const selectedSet = alreadyDone ? (selected || "").split(",") : picks;

  return (
    <div style={{ padding: "0.4rem 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
        {BLOCK_MOVES.map((m) => {
          const active = selectedSet.includes(m.id);
          return (
            <button key={m.id} onClick={() => !alreadyDone && toggle(m.id)} className={alreadyDone ? "" : "chip-interactive"} style={{
              display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.6rem",
              border: active ? "2px solid var(--done)" : "1px solid var(--border)",
              borderRadius: 8, background: active ? "var(--done-bg)" : "var(--card-bg)",
              cursor: alreadyDone ? "default" : "pointer", fontSize: "0.78rem", fontFamily: "inherit", color: "var(--fg)",
              fontWeight: active ? 600 : 400,
            }}>
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
      {!alreadyDone && picks.length > 0 && (
        <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
          <button onClick={() => onConfirm(picks.join(","))} className="btn-interactive" style={btnStyle("var(--done)", "#fff", "0.78rem")}>
            ✓ Pause loggen
          </button>
        </div>
      )}
    </div>
  );
}

function RatingStep({ intention, pomodoroId, onComplete }) {
  const [biz, setBiz] = useState(null);
  const [energy, setEnergy] = useState(null);

  const handleSubmit = async () => {
    if (biz == null || energy == null) return;
    await api.ratePomodoro(pomodoroId, biz, energy);
    onComplete();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.7rem", padding: "0.8rem 0" }}>
      <div style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--fg)", textAlign: "center", background: "var(--muted)", borderRadius: 6, padding: "0.3rem 0.6rem" }}>
        ✓ {intention}
      </div>

      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
          Geschäftswert
        </div>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {BIZ_LEVELS.map((lvl) => (
            <button key={lvl.value} onClick={() => setBiz(lvl.value)} className="chip-interactive" style={{
              flex: 1, padding: "0.4rem 0.2rem", borderRadius: 6, fontSize: "0.65rem", fontFamily: "inherit",
              border: biz === lvl.value ? "2px solid var(--accent)" : "1px solid var(--border)",
              background: biz === lvl.value ? "rgba(196,77,43,0.12)" : "transparent",
              color: biz === lvl.value ? "var(--accent)" : "var(--fg-dim)",
              cursor: "pointer", fontWeight: biz === lvl.value ? 700 : 400,
              display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            }}>
              <span style={{ fontSize: "0.8rem" }}>{lvl.icon}</span>
              <span>{lvl.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
          Energie-Bilanz
        </div>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {ENERGY_LEVELS.map((lvl) => (
            <button key={lvl.value} onClick={() => setEnergy(lvl.value)} className="chip-interactive" style={{
              flex: 1, padding: "0.4rem 0.2rem", borderRadius: 6, fontSize: "0.65rem", fontFamily: "inherit",
              border: energy === lvl.value ? "2px solid var(--done)" : "1px solid var(--border)",
              background: energy === lvl.value ? "rgba(45,138,78,0.12)" : "transparent",
              color: energy === lvl.value ? "var(--done)" : "var(--fg-dim)",
              cursor: "pointer", fontWeight: energy === lvl.value ? 700 : 400,
              display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            }}>
              <span style={{ fontSize: "0.8rem" }}>{lvl.icon}</span>
              <span>{lvl.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="btn-interactive"
        disabled={biz == null || energy == null}
        style={{
          ...btnStyle(biz != null && energy != null ? "var(--accent)" : "var(--muted)", biz != null && energy != null ? "#fff" : "var(--fg-dim)", "0.82rem"),
          opacity: biz != null && energy != null ? 1 : 0.5,
        }}
      >
        Weiter →
      </button>
    </div>
  );
}

function StepIndicator({ block }) {
  const items = [];
  for (let i = 0; i < 4; i++) {
    items.push({ type: "p", done: block.pomodoros[i], label: i + 1 });
    items.push({ type: "m", done: !!block.miniMoves[i] });
  }
  items.push({ type: "b", done: !!block.blockMove });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "0.5rem" }}>
      {items.map((item, idx) => {
        if (item.type === "p") {
          return (
            <div key={idx} style={{
              width: 22, height: 22, borderRadius: "50%",
              border: item.done ? "2px solid var(--done)" : "1px solid var(--border)",
              background: item.done ? "var(--done)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.55rem", color: item.done ? "#fff" : "var(--fg-dim)", fontWeight: 600,
            }}>
              {item.done ? "✓" : item.label}
            </div>
          );
        }
        if (item.type === "m") {
          return (
            <div key={idx} style={{
              width: 10, height: 10, borderRadius: 3,
              background: item.done ? "var(--accent)" : "var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.4rem", color: item.done ? "#fff" : "transparent",
            }}>
              {item.done ? "↑" : ""}
            </div>
          );
        }
        return (
          <div key={idx} style={{
            width: 16, height: 16, borderRadius: 4, marginLeft: 2,
            border: item.done ? "2px solid var(--done)" : "1px dashed var(--border)",
            background: item.done ? "var(--done-bg)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.5rem", color: item.done ? "var(--done)" : "var(--fg-dim)",
          }}>
            {item.done ? "🚶" : "P"}
          </div>
        );
      })}
    </div>
  );
}

function BlockCard({ block, index, isActive, dayId, onUpdate, soundEnabled, onTimerTick, projects, blockRef }) {
  const step = getBlockStep(block);
  const complete = step.type === "done";
  const [intentionDraft, setIntentionDraft] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggleTag = (tagId) => {
    setSelectedTags((prev) => prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const result = await api.createProject(newProjectName.trim());
    setSelectedProject(result.id);
    setNewProjectName("");
    setShowNewProject(false);
    onUpdate();
  };

  const handleSetIntention = async () => {
    if (!intentionDraft.trim()) return;
    await api.createPomodoro(dayId, index, step.index, intentionDraft.trim(), selectedTags, selectedProject);
    setIntentionDraft("");
    setSelectedTags([]);
    setSelectedProject(null);
    onUpdate();
  };

  const handlePomComplete = async () => {
    const currentPomId = block.pomodoroIds[step.index];
    if (currentPomId) {
      await api.completePomodoro(currentPomId);
    }
    onUpdate();
  };

  const handleMiniMove = async (moveIndex, exerciseId) => {
    await api.createMovement(dayId, index, "mini", exerciseId, 60);
    onUpdate();
  };

  const handleBlockMove = async (exerciseIds) => {
    const durations = { walk: 900, rope_long: 600, workout: 600, mobility: 600 };
    const maxDur = Math.max(...exerciseIds.split(",").map((id) => durations[id] || 600));
    await api.createMovement(dayId, index, "block", exerciseIds, maxDur);
    onUpdate();
  };

  // Collapsed view for completed blocks
  const pomsDone = block.pomodoros.filter(Boolean).length;
  const minisDone = block.miniMoves.filter(Boolean).length;

  if (complete && !expanded && !isActive) {
    return (
      <div ref={blockRef} onClick={() => setExpanded(true)} className="card-interactive" style={{
        border: "2px solid var(--done)", borderRadius: 12, padding: "0.6rem 1rem",
        background: "var(--done-bg)", cursor: "pointer", transition: "all 0.2s ease",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1rem", fontWeight: 700, color: "var(--done)" }}>
            Block {BLOCK_LABELS[index]} ✓
          </span>
          <span style={{ fontSize: "0.68rem", color: "var(--fg-dim)" }}>
            {pomsDone} Pomodoros, {minisDone} Moves
          </span>
        </div>
        <span style={{ fontSize: "0.7rem", color: "var(--fg-dim)", transition: "transform 0.2s" }}>▾</span>
      </div>
    );
  }

  return (
    <div ref={blockRef} style={{
      border: isActive ? "2px solid var(--accent)" : complete ? "2px solid var(--done)" : "1px solid var(--border)",
      borderRadius: 12, padding: "1rem", background: complete ? "var(--done-bg)" : "var(--card-bg)",
      transition: "all 0.2s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.15rem", fontWeight: 700, color: complete ? "var(--done)" : "var(--fg)" }}>
          Block {BLOCK_LABELS[index]} {complete && "✓"}
        </span>
        {complete && (
          <button onClick={() => setExpanded(false)} className="btn-interactive" style={{
            background: "transparent", border: "none", fontSize: "0.65rem", color: "var(--fg-dim)",
            cursor: "pointer", fontFamily: "inherit", padding: "0.2rem 0.4rem",
          }}>
            ▴ Einklappen
          </button>
        )}
      </div>

      <StepIndicator block={block} />

      {/* Logged intentions */}
      {block.intentions.some(Boolean) && (
        <div style={{ marginBottom: "0.5rem" }}>
          {block.intentions.map((intent, pi) => intent && (
            <div key={pi} style={{
              fontSize: "0.7rem", color: block.pomodoros[pi] ? "var(--done)" : "var(--fg-dim)",
              padding: "0.15rem 0", display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap",
            }}>
              <span style={{ fontWeight: 600, minWidth: "1.2rem" }}>{pi + 1}.</span>
              {block.projectNames[pi] && (
                <span style={{ fontSize: "0.55rem", background: block.projectColors[pi] || "var(--accent)", color: "#fff", borderRadius: 3, padding: "0 4px", fontWeight: 600 }}>
                  {block.projectNames[pi]}
                </span>
              )}
              <span style={{ textDecoration: block.pomodoros[pi] ? "line-through" : "none", opacity: block.pomodoros[pi] ? 0.6 : 1 }}>{intent}</span>
              {block.valueTags[pi]?.length > 0 && block.valueTags[pi].map((t) => {
                const tag = VALUE_TAGS.find((v) => v.id === t);
                return tag ? <span key={t} style={{ fontSize: "0.5rem" }} title={tag.label}>{tag.icon}</span> : null;
              })}
              {block.bizRatings[pi] != null && (
                <span style={{ fontSize: "0.5rem", color: "var(--accent)" }} title={`Geschäftswert: ${block.bizRatings[pi]}`}>
                  {"●".repeat(block.bizRatings[pi])}
                </span>
              )}
              {block.energyRatings[pi] != null && (
                <span style={{ fontSize: "0.5rem" }}>
                  {block.energyRatings[pi] >= 1 ? "🟢" : block.energyRatings[pi] <= -1 ? "🔴" : "⚪"}
                </span>
              )}
              {block.pomodoros[pi] && <span style={{ fontSize: "0.6rem" }}>✓</span>}
            </div>
          ))}
        </div>
      )}

      {/* Intention + Timer step */}
      {isActive && step.type === "pomodoro" && (
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.15rem" }}>
            Pomodoro {step.index + 1} von 4
          </div>

          {!block.intentions[step.index] ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", padding: "1rem 0" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--accent)", textAlign: "center" }}>
                Was ist dein Fokus für diesen Pomodoro?
              </div>

              {/* Project selector */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", justifyContent: "center", maxWidth: 340 }}>
                {projects.map((p) => (
                  <button key={p.id} onClick={() => setSelectedProject(selectedProject === p.id ? null : p.id)} className="chip-interactive" style={{
                    padding: "0.25rem 0.5rem", borderRadius: 5, fontSize: "0.65rem", fontFamily: "inherit",
                    border: selectedProject === p.id ? `2px solid ${p.color}` : "1px solid var(--border)",
                    background: selectedProject === p.id ? `${p.color}18` : "transparent",
                    color: selectedProject === p.id ? p.color : "var(--fg-dim)",
                    cursor: "pointer", fontWeight: selectedProject === p.id ? 700 : 400,
                  }}>
                    {p.name}
                  </button>
                ))}
                {!showNewProject ? (
                  <button onClick={() => setShowNewProject(true)} className="chip-interactive" style={{
                    padding: "0.25rem 0.5rem", borderRadius: 5, fontSize: "0.65rem", fontFamily: "inherit",
                    border: "1px dashed var(--border)", background: "transparent", color: "var(--fg-dim)",
                    cursor: "pointer",
                  }}>
                    + Projekt
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: "0.2rem" }}>
                    <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); }}
                      placeholder="Name..." style={{
                        width: 100, padding: "0.2rem 0.4rem", fontSize: "0.65rem", fontFamily: "inherit",
                        border: "1px solid var(--border)", borderRadius: 5, background: "var(--bg)", color: "var(--fg)",
                      }} />
                    <button onClick={handleCreateProject} style={{
                      padding: "0.2rem 0.4rem", fontSize: "0.65rem", fontFamily: "inherit",
                      border: "1px solid var(--accent)", borderRadius: 5, background: "var(--accent)", color: "#fff", cursor: "pointer",
                    }}>✓</button>
                  </div>
                )}
              </div>

              <input
                type="text"
                value={intentionDraft}
                onChange={(e) => setIntentionDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && intentionDraft.trim()) handleSetIntention(); }}
                placeholder="z.B. CRM API fertig bauen"
                style={{
                  width: "100%", maxWidth: 320, padding: "0.6rem 0.8rem",
                  border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.85rem",
                  fontFamily: "inherit", background: "var(--bg)", color: "var(--fg)",
                }}
              />

              {/* Value tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", justifyContent: "center", maxWidth: 340 }}>
                {VALUE_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag.id);
                  return (
                    <button key={tag.id} onClick={() => toggleTag(tag.id)} className="chip-interactive" style={{
                      display: "flex", alignItems: "center", gap: "0.25rem",
                      padding: "0.3rem 0.55rem", borderRadius: 6, fontSize: "0.68rem", fontFamily: "inherit",
                      border: active ? `2px solid ${tag.color}` : "1px solid var(--border)",
                      background: active ? `${tag.color}20` : "transparent",
                      color: active ? tag.color : "var(--fg-dim)",
                      cursor: "pointer", fontWeight: active ? 600 : 400,
                    }}>
                      <span style={{ fontSize: "0.8rem" }}>{tag.icon}</span>
                      {tag.label}
                    </button>
                  );
                })}
              </div>

              <button onClick={handleSetIntention} disabled={!intentionDraft.trim()} className="btn-interactive" style={{
                ...btnStyle(intentionDraft.trim() ? "var(--accent)" : "var(--muted)", intentionDraft.trim() ? "#fff" : "var(--fg-dim)", "0.82rem"),
                opacity: intentionDraft.trim() ? 1 : 0.5,
              }}>
                Fokus setzen →
              </button>
            </div>
          ) : (
            <PomodoroTimer
              key={`${index}-${step.index}`}
              timerKey={`pom-${index}-${step.index}`}
              intention={block.intentions[step.index]}
              onComplete={handlePomComplete}
              autoStart
              soundEnabled={soundEnabled}
              onTick={(secs, running) => onTimerTick && onTimerTick(secs, running, block.intentions[step.index])}
            />
          )}
        </div>
      )}

      {/* Rating step (after pom, before mini-move) */}
      {isActive && step.type === "rating" && (
        <RatingStep
          intention={block.intentions[step.index]}
          pomodoroId={block.pomodoroIds[step.index]}
          onComplete={onUpdate}
        />
      )}

      {/* Mini-move step */}
      {isActive && step.type === "miniMove" && (
        <div>
          <div style={{
            fontSize: "0.82rem", fontWeight: 700, color: "var(--accent)", marginBottom: "0.15rem",
            textAlign: "center", padding: "0.3rem 0",
          }}>
            ↑ Aufstehen! Mindestens 1 Minute bewegen
          </div>
          <QuickMovePicker selected={block.miniMoves[step.index]} onConfirm={(ids) => handleMiniMove(step.index, ids)} />
        </div>
      )}

      {/* Block pause step */}
      {isActive && step.type === "blockMove" && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--done)", marginBottom: "0.25rem", textAlign: "center" }}>
            🎯 Block geschafft! Grössere Pause wählen:
          </div>
          <BlockMovePicker selected={block.blockMove} onConfirm={handleBlockMove} />
        </div>
      )}
    </div>
  );
}


export default function HealthTracker({ theme, settings, onSettingsChange }) {
  const [dayData, setDayData] = useState(null);
  const [blocks, setBlocks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gamification, setGamification] = useState(null);
  const [timerInfo, setTimerInfo] = useState(null);
  const [projects, setProjects] = useState([]);
  const blockRefs = useRef([null, null, null, null]);

  const loadData = useCallback(async () => {
    try {
      const [data, gamHistory, projs] = await Promise.all([
        api.getToday(),
        api.getGamificationHistory(7),
        api.getProjects(),
      ]);
      setDayData(data);
      const builtBlocks = buildBlocksFromDB(data.pomodoros || [], data.movements || []);
      setBlocks(builtBlocks);
      setGamification({
        current: data.gamification || { current_rank: 1, streak_length: 0, cumulative_points: 0 },
        history: gamHistory || [],
      });
      setProjects(projs || []);

      // Guard: clear stale localStorage timer if DB has no matching pomodoro
      const saved = loadTimer();
      if (saved && saved.key) {
        const [, blockIdx, pomIdx] = saved.key.match(/pom-(\d+)-(\d+)/) || [];
        if (blockIdx != null) {
          const block = builtBlocks[parseInt(blockIdx)];
          if (!block || !block.intentions[parseInt(pomIdx)]) {
            saveTimer(null);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-scroll to the active block when blocks change
  useEffect(() => {
    if (!blocks) return;
    const idx = blocks.findIndex((b) => !isBlockComplete(b));
    if (idx >= 0 && blockRefs.current[idx]) {
      setTimeout(() => {
        blockRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [blocks]);

  // Persist gamification data to server whenever blocks/dayData change
  const prevGamKey = useRef("");
  useEffect(() => {
    if (!dayData?.day?.id || !blocks) return;
    const pomCount = blocks.reduce((s, b) => s + b.pomodoros.filter(Boolean).length, 0);
    const moveCount = blocks.reduce((s, b) => s + b.miniMoves.filter(Boolean).length, 0)
      + blocks.filter((b) => b.blockMove).length;
    const bizSum = blocks.reduce((s, b) => s + b.bizRatings.reduce((sum, r) => sum + (r || 0), 0), 0);
    const energySum = blocks.reduce((s, b) => s + b.energyRatings.reduce((sum, r) => sum + (r || 0), 0), 0);
    // Build a key to detect actual changes (avoids duplicate writes)
    const key = `${pomCount}-${moveCount}-${bizSum}-${energySum}`;
    if (key === prevGamKey.current) return;
    prevGamKey.current = key;
    if (pomCount === 0 && moveCount === 0) return;

    const retroCount = (dayData.pomodoros || []).filter((p) => p.retroactive).length;
    const xp = calcDayXP(pomCount, moveCount, bizSum, energySum, retroCount);
    const sl = dayData.streakLength || 0;
    const effXP = calcEffectiveXP(xp, sl);
    const cumXP = (gamification?.current?.cumulative_xp || 0) + effXP - (dayData.day.effective_xp || 0);
    const lp = getLevelProgress(cumXP);

    api.updateDayPoints(dayData.day.id, pomCount + moveCount, xp, effXP, sl, lp.level).catch(() => {});
    api.upsertGamification({
      date: dayData.day.date,
      cumulative_points: pomCount + moveCount,
      cumulative_xp: cumXP,
      current_rank: lp.level,
      streak_length: sl,
      level_change: "none",
    }).catch(() => {});
  }, [blocks, dayData, gamification]);

  // Gap detection: >30 min since last completed pomodoro
  const [gapDismissed, setGapDismissed] = useState(false);
  const gapMinutes = (() => {
    if (!dayData?.lastCompleted) return 0;
    const lastMs = new Date(dayData.lastCompleted + "Z").getTime();
    return Math.floor((Date.now() - lastMs) / 60000);
  })();
  const showGapAudit = !gapDismissed && gapMinutes >= GAP_THRESHOLD_MIN && Math.floor(gapMinutes / 25) >= 1;

  if (loading || !blocks || !dayData) return <div style={{ padding: "2rem", textAlign: "center" }}>Laden...</div>;

  const activeBlock = blocks.findIndex((b) => !isBlockComplete(b));
  const totalPom = blocks.reduce((s, b) => s + b.pomodoros.filter(Boolean).length, 0);
  const totalMini = blocks.reduce((s, b) => s + b.miniMoves.filter(Boolean).length, 0);
  const totalBlock = blocks.filter((b) => b.blockMove).length;
  const totalBizRating = blocks.reduce((s, b) => s + b.bizRatings.reduce((sum, r) => sum + (r || 0), 0), 0);
  const totalEnergy = blocks.reduce((s, b) => s + b.energyRatings.reduce((sum, r) => sum + (r || 0), 0), 0);
  const totalRetro = (dayData.pomodoros || []).filter((p) => p.retroactive).length;
  const drainCount = blocks.reduce((s, b) => s + b.energyRatings.filter((r) => r === -2).length, 0);
  const showEnergyWarning = drainCount >= 3;
  const allDone = activeBlock === -1;

  // XP system
  const dayXP = calcDayXP(totalPom, totalMini + totalBlock, totalBizRating, totalEnergy, totalRetro);
  const streak = dayData.streakLength || 0;
  const streakMult = getStreakMultiplier(streak);
  const effectiveXP = calcEffectiveXP(dayXP, streak);
  const cumulativeXP = (gamification?.current?.cumulative_xp || 0) + effectiveXP - (dayData.day.effective_xp || 0);
  const levelProgress = getLevelProgress(cumulativeXP);
  const currentRank = levelProgress.level;
  const rank = getRank(currentRank);

  return (
    <div style={pageStyle(theme)}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet" />

      {/* Header: collapses when timer is active */}
      <div style={{ marginBottom: "0.6rem" }}>
        {timerInfo && timerInfo.seconds > 0 ? (
          /* Compact header with live timer */
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--fg-dim)", fontWeight: 500 }}>
              {new Date().toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {timerInfo.intention && (
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--fg)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {timerInfo.intention}
                </div>
              )}
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: "1rem", fontWeight: 700,
                color: timerInfo.running ? "var(--accent)" : "var(--fg-dim)",
                background: timerInfo.running ? "rgba(196,77,43,0.08)" : "var(--muted)",
                padding: "0.2rem 0.5rem", borderRadius: 6,
              }}>
                {String(Math.floor(timerInfo.seconds / 60)).padStart(2, "0")}:{String(timerInfo.seconds % 60).padStart(2, "0")}
              </div>
            </div>
          </div>
        ) : (
          /* Full header when no timer */
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.7rem", fontWeight: 700, margin: 0 }}>🏛️ Health System</h1>
            <p style={{ fontSize: "0.78rem", color: "var(--fg-dim)", margin: "0.25rem 0 0", fontWeight: 500 }}>
              {new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        )}
      </div>

      {/* Rank & Streak */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem",
        padding: "0.5rem 0.8rem", marginBottom: "0.7rem",
        background: "linear-gradient(135deg, rgba(196,77,43,0.08), rgba(45,138,78,0.08))",
        borderRadius: 10, border: "1px solid var(--border)",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.55rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Rang {currentRank}/30</div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1rem", fontWeight: 700, color: "var(--accent)" }}>{rank.name}</div>
          {/* XP Progress Bar */}
          <div style={{ marginTop: "0.3rem" }}>
            <div style={{ height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${levelProgress.progress * 100}%`, background: "var(--accent)", borderRadius: 2, transition: "width 0.3s ease" }} />
            </div>
            <div style={{ fontSize: "0.5rem", color: "var(--fg-dim)", marginTop: "0.1rem" }}>
              {cumulativeXP.toLocaleString("de-CH")} / {levelProgress.needed.toLocaleString("de-CH")} XP
            </div>
          </div>
        </div>
        <div style={{ width: 1, height: 40, background: "var(--border)" }} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.55rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Streak</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: streak > 0 ? "var(--done)" : "var(--fg-dim)" }}>
            {streak} {streak === 1 ? "Tag" : "Tage"}
          </div>
          {streakMult > 1 && (
            <div style={{ fontSize: "0.55rem", color: "var(--done)", fontWeight: 600 }}>
              {streakMult}x XP
            </div>
          )}
        </div>
      </div>

      {/* Counters */}
      <div style={{ display: "flex", justifyContent: "center", gap: "1.2rem", padding: "0.5rem 0 0.7rem", marginBottom: "0.7rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: totalPom > 0 ? "var(--accent)" : "var(--fg-dim)" }}>{totalPom}/16</div>
          <div style={{ fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pomodoros</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: totalMini > 0 ? "var(--accent)" : "var(--fg-dim)" }}>{totalMini}/16</div>
          <div style={{ fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mini-Moves</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: totalBlock > 0 ? "var(--done)" : "var(--fg-dim)" }}>{totalBlock}/4</div>
          <div style={{ fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pausen</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: effectiveXP > 0 ? "var(--accent)" : "var(--fg-dim)" }}>{effectiveXP}</div>
          <div style={{ fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>XP</div>
        </div>
      </div>

      <div style={{
        background: "var(--muted)", borderRadius: 8, padding: "0.55rem 0.8rem", marginBottom: "0.9rem",
        fontSize: "0.72rem", color: "var(--fg-dim)", fontWeight: 500, textAlign: "center", fontStyle: "italic",
      }}>
        Fokus → Pomodoro → Bewertung → Bewegung → … → grosse Pause
      </div>

      {/* Energy warning */}
      {showEnergyWarning && (
        <div style={{
          background: "rgba(220, 50, 50, 0.12)", border: "1px solid rgba(220, 50, 50, 0.3)",
          borderRadius: 8, padding: "0.5rem 0.8rem", marginBottom: "0.7rem",
          fontSize: "0.75rem", fontWeight: 600, color: "#c44", textAlign: "center",
        }}>
          Zu viel draining work heute — achte auf deine Energie.
        </div>
      )}

      {/* Gap audit — blocks further progress until resolved */}
      {showGapAudit && (
        <GapAudit
          gapMinutes={gapMinutes}
          lastTime={dayData.lastCompleted}
          dayId={dayData.day.id}
          projects={projects}
          onComplete={() => { setGapDismissed(true); loadData(); }}
        />
      )}

      {allDone && (
        <div style={{
          background: "var(--done)", color: "#fff", borderRadius: 10, padding: "1rem",
          textAlign: "center", marginBottom: "0.9rem", fontSize: "0.92rem", fontWeight: 600,
        }}>
          🎯 Tag geschafft. 16 Pomodoros, 16 Mini-Moves, 4 Pausen. Feierabend.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {blocks.map((block, i) => (
          <BlockCard
            key={i}
            block={block}
            index={i}
            isActive={i === activeBlock}
            dayId={dayData.day.id}
            onUpdate={loadData}
            soundEnabled={settings?.soundEnabled}
            onTimerTick={(secs, running, intention) => setTimerInfo({ seconds: secs, running, intention })}
            projects={projects}
            blockRef={(el) => { blockRefs.current[i] = el; }}
          />
        ))}
      </div>

    </div>
  );
}
