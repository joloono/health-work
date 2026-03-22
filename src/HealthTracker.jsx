import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api.js";
import { getRank, calcDayPoints, dayCountsForStreak, calculateRankChange, calculateLevelLoss } from "./gamification.js";
import { playNotificationSound } from "./useSettings.js";

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

const VALUE_TAGS = [
  { id: "umsatz", label: "Umsatz", icon: "💰" },
  { id: "gesundheit", label: "Gesundheit", icon: "🏥" },
  { id: "investition", label: "Investition", icon: "🌱" },
  { id: "oekosystem", label: "App-Ökosystem", icon: "🔧" },
  { id: "systeme", label: "Systeme", icon: "⚙️" },
];

function parseValueTags(raw) {
  if (!raw) return [];
  return raw.split(",").filter(Boolean);
}

// Rebuild block state from DB records
function buildBlocksFromDB(pomodoros, movements) {
  const blocks = Array.from({ length: 4 }, () => ({
    pomodoros: [false, false, false, false],
    intentions: [null, null, null, null],
    valueTags: [[], [], [], []],
    pomodoroIds: [null, null, null, null],
    miniMoves: [null, null, null],
    blockMove: null,
  }));

  for (const p of pomodoros) {
    const b = blocks[p.block_index];
    if (b) {
      b.intentions[p.pom_index] = p.intention;
      b.valueTags[p.pom_index] = parseValueTags(p.value_tags);
      b.pomodoroIds[p.pom_index] = p.id;
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

function getBlockStep(block) {
  for (let i = 0; i < 4; i++) {
    if (!block.pomodoros[i]) return { type: "pomodoro", index: i };
    if (i < 3 && !block.miniMoves[i]) return { type: "miniMove", index: i };
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

function PomodoroTimer({ onComplete, autoStart = false, soundEnabled = true, onTick }) {
  const WORK = 25 * 60;
  const [remaining, setRemaining] = useState(WORK);
  const [running, setRunning] = useState(autoStart);
  const ref = useRef(null);
  const soundPlayed = useRef(false);

  useEffect(() => {
    if (running && remaining > 0) {
      ref.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) { clearInterval(ref.current); setRunning(false); return 0; }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(ref.current);
  }, [running, remaining]);

  // Report timer state upward for minibar
  useEffect(() => {
    if (onTick) onTick(remaining, running);
  }, [remaining, running]);

  // Play sound when timer completes
  useEffect(() => {
    if (remaining === 0 && !soundPlayed.current && soundEnabled) {
      soundPlayed.current = true;
      playNotificationSound();
    }
  }, [remaining, soundEnabled]);

  const progress = 1 - remaining / WORK;
  const done = remaining === 0;
  const r = 62;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "1rem 0" }}>
      <div style={{ position: "relative", width: 140, height: 140 }}>
        <svg viewBox="0 0 140 140" width="140" height="140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
          <circle cx="70" cy="70" r={r} fill="none" stroke={done ? "var(--done)" : "var(--accent)"} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * r}`} strokeDashoffset={`${2 * Math.PI * r * (1 - progress)}`}
            transform="rotate(-90 70 70)" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TimerDisplay seconds={remaining} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.6rem" }}>
        {!done && (
          <button onClick={() => setRunning(!running)} style={btnStyle(running ? "var(--muted)" : "var(--accent)", running ? "var(--fg)" : "#fff")}>
            {running ? "Pause" : remaining === WORK ? "Start" : "Weiter"}
          </button>
        )}
        {done && (
          <button onClick={onComplete} style={btnStyle("var(--done)", "#fff")}>✓ Fertig</button>
        )}
        {!done && remaining < WORK && (
          <button onClick={() => { setRemaining(WORK); setRunning(false); }} style={{ ...btnStyle("transparent", "var(--fg-dim)"), border: "1px solid var(--border)" }}>
            Reset
          </button>
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
        <button onClick={() => setRunning(!running)} style={btnStyle(running ? "var(--muted)" : "var(--accent)", running ? "var(--fg)" : "#fff", "0.8rem")}>
          {running ? "Pause" : secs === 60 ? "Los!" : "Weiter"}
        </button>
      )}
    </div>
  );
}

function QuickMovePicker({ onSelect, selected }) {
  const [timerDone, setTimerDone] = useState(false);

  return (
    <div style={{ padding: "0.5rem 0" }}>
      {!timerDone && !selected && <MoveCountdown onFinished={() => setTimerDone(true)} />}
      {(timerDone || selected) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", marginTop: "0.5rem" }}>
          {QUICK_MOVES.map((m) => (
            <button key={m.id} onClick={() => onSelect(m.id)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem",
              padding: "0.45rem 0.2rem", border: selected === m.id ? "2px solid var(--done)" : "1px solid var(--border)",
              borderRadius: 8, background: selected === m.id ? "var(--done-bg)" : "var(--card-bg)",
              cursor: "pointer", fontSize: "0.72rem", fontFamily: "inherit", color: "var(--fg)",
              fontWeight: selected === m.id ? 600 : 400, transition: "all 0.15s ease",
            }}>
              <span style={{ fontSize: "1rem" }}>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockMovePicker({ onSelect, selected }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", padding: "0.4rem 0" }}>
      {BLOCK_MOVES.map((m) => (
        <button key={m.id} onClick={() => onSelect(m.id)} style={{
          display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.6rem",
          border: selected === m.id ? "2px solid var(--done)" : "1px solid var(--border)",
          borderRadius: 8, background: selected === m.id ? "var(--done-bg)" : "var(--card-bg)",
          cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", color: "var(--fg)",
          fontWeight: selected === m.id ? 600 : 400, transition: "all 0.15s ease",
        }}>
          <span>{m.icon}</span>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

function StepIndicator({ block }) {
  const items = [];
  for (let i = 0; i < 4; i++) {
    items.push({ type: "p", done: block.pomodoros[i], label: i + 1 });
    if (i < 3) items.push({ type: "m", done: !!block.miniMoves[i] });
  }
  items.push({ type: "b", done: !!block.blockMove });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "0.5rem" }}>
      {items.map((item, idx) => {
        if (item.type === "p") {
          return (
            <div key={idx} style={{
              width: 24, height: 24, borderRadius: "50%",
              border: item.done ? "2px solid var(--done)" : "1px solid var(--border)",
              background: item.done ? "var(--done)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.6rem", color: item.done ? "#fff" : "var(--fg-dim)", fontWeight: 600,
            }}>
              {item.done ? "✓" : item.label}
            </div>
          );
        }
        if (item.type === "m") {
          return (
            <div key={idx} style={{
              width: 12, height: 12, borderRadius: 3,
              background: item.done ? "var(--accent)" : "var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.45rem", color: item.done ? "#fff" : "transparent",
            }}>
              {item.done ? "↑" : ""}
            </div>
          );
        }
        return (
          <div key={idx} style={{
            width: 18, height: 18, borderRadius: 4, marginLeft: 2,
            border: item.done ? "2px solid var(--done)" : "1px dashed var(--border)",
            background: item.done ? "var(--done-bg)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.55rem", color: item.done ? "var(--done)" : "var(--fg-dim)",
          }}>
            {item.done ? "🚶" : "P"}
          </div>
        );
      })}
    </div>
  );
}

function BlockCard({ block, index, isActive, dayId, onUpdate, soundEnabled, onTimerTick }) {
  const step = getBlockStep(block);
  const complete = step.type === "done";
  const [intentionDraft, setIntentionDraft] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);

  const toggleTag = (tagId) => {
    setSelectedTags((prev) => prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]);
  };

  const handleSetIntention = async () => {
    if (!intentionDraft.trim()) return;
    await api.createPomodoro(dayId, index, step.index, intentionDraft.trim(), selectedTags);
    setIntentionDraft("");
    setSelectedTags([]);
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

  const handleBlockMove = async (exerciseId) => {
    const durations = { walk: 900, rope_long: 600, workout: 600, mobility: 600 };
    await api.createMovement(dayId, index, "block", exerciseId, durations[exerciseId] || 600);
    onUpdate();
  };

  return (
    <div style={{
      border: isActive ? "2px solid var(--accent)" : complete ? "2px solid var(--done)" : "1px solid var(--border)",
      borderRadius: 12, padding: "1rem", background: complete ? "var(--done-bg)" : "var(--card-bg)",
      transition: "all 0.2s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.15rem", fontWeight: 700, color: complete ? "var(--done)" : "var(--fg)" }}>
          Block {BLOCK_LABELS[index]} {complete && "✓"}
        </span>
      </div>

      <StepIndicator block={block} />

      {block.intentions.some(Boolean) && (
        <div style={{ marginBottom: "0.5rem" }}>
          {block.intentions.map((intent, pi) => intent && (
            <div key={pi} style={{
              fontSize: "0.7rem", color: block.pomodoros[pi] ? "var(--done)" : "var(--fg-dim)",
              padding: "0.15rem 0", display: "flex", alignItems: "center", gap: "0.3rem",
            }}>
              <span style={{ fontWeight: 600, minWidth: "1.2rem" }}>{pi + 1}.</span>
              <span style={{ textDecoration: block.pomodoros[pi] ? "line-through" : "none", opacity: block.pomodoros[pi] ? 0.6 : 1 }}>{intent}</span>
              {block.valueTags[pi]?.length > 0 && block.valueTags[pi].map((t) => {
                const tag = VALUE_TAGS.find((v) => v.id === t);
                return tag ? <span key={t} style={{ fontSize: "0.5rem" }} title={tag.label}>{tag.icon}</span> : null;
              })}
              {block.pomodoros[pi] && <span style={{ fontSize: "0.6rem" }}>✓</span>}
            </div>
          ))}
        </div>
      )}

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
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", justifyContent: "center", maxWidth: 340 }}>
                {VALUE_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag.id);
                  return (
                    <button key={tag.id} onClick={() => toggleTag(tag.id)} style={{
                      display: "flex", alignItems: "center", gap: "0.25rem",
                      padding: "0.3rem 0.55rem", borderRadius: 6, fontSize: "0.68rem", fontFamily: "inherit",
                      border: active ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: active ? "rgba(196, 77, 43, 0.1)" : "transparent",
                      color: active ? "var(--accent)" : "var(--fg-dim)",
                      cursor: "pointer", fontWeight: active ? 600 : 400,
                      transition: "all 0.15s ease",
                    }}>
                      <span style={{ fontSize: "0.8rem" }}>{tag.icon}</span>
                      {tag.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleSetIntention}
                disabled={!intentionDraft.trim()}
                style={{
                  ...btnStyle(intentionDraft.trim() ? "var(--accent)" : "var(--muted)", intentionDraft.trim() ? "#fff" : "var(--fg-dim)", "0.82rem"),
                  opacity: intentionDraft.trim() ? 1 : 0.5,
                }}
              >
                Fokus setzen →
              </button>
            </div>
          ) : (
            <div>
              <div style={{
                background: "var(--muted)", borderRadius: 6, padding: "0.4rem 0.7rem", marginBottom: "0.5rem",
                fontSize: "0.78rem", fontWeight: 500, color: "var(--fg)", textAlign: "center",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              }}>
                🎯 {block.intentions[step.index]}
                {block.valueTags[step.index]?.map((t) => {
                  const tag = VALUE_TAGS.find((v) => v.id === t);
                  return tag ? <span key={t} style={{ fontSize: "0.55rem" }} title={tag.label}>{tag.icon}</span> : null;
                })}
              </div>
              <PomodoroTimer key={`${index}-${step.index}`} onComplete={handlePomComplete} autoStart soundEnabled={soundEnabled} onTick={(secs, running) => onTimerTick && onTimerTick(secs, running, block.intentions[step.index])} />
            </div>
          )}
        </div>
      )}

      {isActive && step.type === "miniMove" && (
        <div>
          <div style={{
            fontSize: "0.82rem", fontWeight: 700, color: "var(--accent)", marginBottom: "0.15rem",
            textAlign: "center", padding: "0.3rem 0",
          }}>
            ↑ Aufstehen! Mindestens 1 Minute bewegen
          </div>
          <QuickMovePicker selected={block.miniMoves[step.index]} onSelect={(id) => handleMiniMove(step.index, id)} />
        </div>
      )}

      {isActive && step.type === "blockMove" && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--done)", marginBottom: "0.25rem", textAlign: "center" }}>
            🎯 Block geschafft! Grössere Pause wählen:
          </div>
          <BlockMovePicker selected={block.blockMove} onSelect={handleBlockMove} />
        </div>
      )}
    </div>
  );
}

function btnStyle(bg, fg, size = "0.88rem") {
  return {
    background: bg, color: fg, border: "none", borderRadius: 8,
    padding: "0.5rem 1.4rem", fontSize: size, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  };
}

export default function HealthTracker({ onDashboard, theme, settings, onSettingsChange }) {
  const [dayData, setDayData] = useState(null);
  const [blocks, setBlocks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gamification, setGamification] = useState(null);
  const [timerInfo, setTimerInfo] = useState(null); // { seconds, running, intention }

  const loadData = useCallback(async () => {
    try {
      const [data, gamHistory] = await Promise.all([
        api.getToday(),
        api.getGamificationHistory(7),
      ]);
      setDayData(data);
      setBlocks(buildBlocksFromDB(data.pomodoros || [], data.movements || []));
      setGamification({
        current: data.gamification || { current_rank: 1, streak_length: 0, cumulative_points: 0 },
        history: gamHistory || [],
      });
    } catch (e) {
      console.error("Failed to load:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Persist gamification when points change
  const persistGamification = useCallback(async (pts, pomCount, moveCount) => {
    if (!dayData || !gamification) return;
    const today = new Date().toISOString().slice(0, 10);
    const prev = gamification.current;
    const streak = dayCountsForStreak(pomCount, moveCount)
      ? (prev.streak_length || 0) + (prev.date === today ? 0 : 1) || 1
      : prev.streak_length || 0;
    const cumPts = (prev.cumulative_points || 0) + pts - (dayData.day.total_points || 0);

    // Check for level up
    const recentPoints = gamification.history.map((h) => h.cumulative_points);
    const { newRank, change } = calculateRankChange(prev.current_rank || 1, streak, [pts, ...recentPoints]);

    await Promise.all([
      api.updateDayPoints(dayData.day.id, pts, streak, newRank),
      api.upsertGamification({ date: today, cumulative_points: cumPts, current_rank: newRank, streak_length: streak, level_change: change }),
    ]);
  }, [dayData, gamification]);

  if (loading || !blocks || !dayData) return <div style={{ padding: "2rem", textAlign: "center" }}>Laden...</div>;

  const activeBlock = blocks.findIndex((b) => !isBlockComplete(b));
  const totalPom = blocks.reduce((s, b) => s + b.pomodoros.filter(Boolean).length, 0);
  const totalMini = blocks.reduce((s, b) => s + b.miniMoves.filter(Boolean).length, 0);
  const totalBlock = blocks.filter((b) => b.blockMove).length;
  const totalTagged = blocks.reduce((s, b) => s + b.valueTags.filter((tags, i) => tags.length > 0 && b.pomodoros[i]).length, 0);
  const allDone = activeBlock === -1;
  const points = calcDayPoints(totalPom, totalMini + totalBlock, totalTagged);

  const currentRank = gamification?.current?.current_rank || 1;
  const streak = gamification?.current?.streak_length || 0;
  const rank = getRank(currentRank);

  return (
    <div style={{
      ...theme,
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      maxWidth: 480, margin: "0 auto", padding: "1.5rem 1rem", color: "var(--fg)",
      minHeight: "100vh", background: "var(--bg)",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet" />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: "0.6rem", position: "relative" }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.7rem", fontWeight: 700, margin: 0 }}>Health System</h1>
          <p style={{ fontSize: "0.78rem", color: "var(--fg-dim)", margin: "0.25rem 0 0", fontWeight: 500 }}>
            {new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {/* Timer minibar top-right */}
        {timerInfo && timerInfo.seconds > 0 && (
          <div style={{
            position: "absolute", right: 0, top: 0,
            display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: "0.9rem", fontWeight: 700,
              color: timerInfo.running ? "var(--accent)" : "var(--fg-dim)",
            }}>
              {String(Math.floor(timerInfo.seconds / 60)).padStart(2, "0")}:{String(timerInfo.seconds % 60).padStart(2, "0")}
            </div>
            {timerInfo.intention && (
              <div style={{
                fontSize: "0.55rem", color: "var(--fg-dim)", maxWidth: 100,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right",
              }}>
                {timerInfo.intention}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rank & Streak display */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem",
        padding: "0.5rem 0.8rem", marginBottom: "0.7rem",
        background: "linear-gradient(135deg, rgba(196,77,43,0.08), rgba(45,138,78,0.08))",
        borderRadius: 10, border: "1px solid var(--border)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.6rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Rang {currentRank}/30</div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1rem", fontWeight: 700, color: "var(--accent)" }}>{rank.name}</div>
          <div style={{ fontSize: "0.62rem", color: "var(--fg-dim)" }}>{rank.title}</div>
        </div>
        <div style={{ width: 1, height: 32, background: "var(--border)" }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.6rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Streak</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: streak > 0 ? "var(--done)" : "var(--fg-dim)" }}>{streak} {streak === 1 ? "Tag" : "Tage"}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "1.2rem", padding: "0.5rem 0 0.7rem", marginBottom: "0.7rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: totalPom > 0 ? "var(--accent)" : "var(--fg-dim)" }}>{totalPom}/16</div>
          <div style={{ fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pomodoros</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: totalMini > 0 ? "var(--accent)" : "var(--fg-dim)" }}>{totalMini}/12</div>
          <div style={{ fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mini-Moves</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: totalBlock > 0 ? "var(--done)" : "var(--fg-dim)" }}>{totalBlock}/4</div>
          <div style={{ fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pausen</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: points > 0 ? "var(--accent)" : "var(--fg-dim)" }}>{points}</div>
          <div style={{ fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Punkte</div>
        </div>
      </div>

      <div style={{
        background: "var(--muted)", borderRadius: 8, padding: "0.55rem 0.8rem", marginBottom: "0.9rem",
        fontSize: "0.72rem", color: "var(--fg-dim)", fontWeight: 500, textAlign: "center", fontStyle: "italic",
      }}>
        Fokus setzen → Pomodoro → Bewegung (1 min+) → Fokus setzen → … → grosse Pause
      </div>

      {allDone && (
        <div style={{
          background: "var(--done)", color: "#fff", borderRadius: 10, padding: "1rem",
          textAlign: "center", marginBottom: "0.9rem", fontSize: "0.92rem", fontWeight: 600,
        }}>
          🎯 Tag geschafft. 16 Pomodoros, 12 Mini-Moves, 4 Pausen. Feierabend.
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
          />
        ))}
      </div>

      {/* Footer: Dashboard + Settings */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", marginTop: "1.2rem", flexWrap: "wrap" }}>
        <button onClick={onDashboard} style={{
          background: "transparent", border: "1px solid var(--border)", borderRadius: 8,
          padding: "0.5rem 1.2rem", fontSize: "0.78rem", color: "var(--fg-dim)", cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
        }}>
          Dashboard →
        </button>
        <button onClick={() => onSettingsChange({ darkMode: !settings.darkMode })} style={{
          background: "transparent", border: "1px solid var(--border)", borderRadius: 8,
          padding: "0.5rem 0.8rem", fontSize: "0.78rem", color: "var(--fg-dim)", cursor: "pointer", fontFamily: "inherit",
        }}>
          {settings.darkMode ? "☀️" : "🌙"}
        </button>
        <button onClick={() => onSettingsChange({ soundEnabled: !settings.soundEnabled })} style={{
          background: "transparent", border: "1px solid var(--border)", borderRadius: 8,
          padding: "0.5rem 0.8rem", fontSize: "0.78rem", color: "var(--fg-dim)", cursor: "pointer", fontFamily: "inherit",
        }}>
          {settings.soundEnabled ? "🔔" : "🔕"}
        </button>
      </div>
    </div>
  );
}
