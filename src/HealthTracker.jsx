import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api.js";
import { getRank, calcDayXPFlex, calcEffectiveXP, getStreakMultiplier, getLevelProgress, xpForLevel } from "./gamification.js";
import { playNotificationSound, playReturnSound, playCompletionChime } from "./useSettings.js";
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

// --- Timer persistence (localStorage + server) ---

const TIMER_KEY = "health-active-timer";
function saveTimer(data) {
  if (data) {
    localStorage.setItem(TIMER_KEY, JSON.stringify(data));
    api.setTimer({
      entry_id: data.entryId || null, intention: data.intention || "",
      duration_seconds: (data.duration || 25) * 60, end_time: data.endTime || null,
      pause_remaining: data.pauseRemaining || 0, paused: data.paused ? 1 : 0,
      entry_type: data.entryType || "pomodoro",
    }).catch(() => {});
  } else {
    localStorage.removeItem(TIMER_KEY);
    api.clearTimer().catch(() => {});
  }
}
function loadTimer() {
  try { return JSON.parse(localStorage.getItem(TIMER_KEY)); } catch { return null; }
}
// Sync from server timer to localStorage (on load)
function syncTimerFromServer(serverTimer) {
  if (!serverTimer) { localStorage.removeItem(TIMER_KEY); return null; }
  const data = {
    key: `entry-${serverTimer.entry_id}`,
    endTime: serverTimer.end_time, paused: !!serverTimer.paused,
    pauseRemaining: serverTimer.pause_remaining || 0,
    intention: serverTimer.intention, entryId: serverTimer.entry_id,
    entryType: serverTimer.entry_type || "pomodoro",
    duration: Math.round(serverTimer.duration_seconds / 60),
  };
  localStorage.setItem(TIMER_KEY, JSON.stringify(data));
  return data;
}

// --- WebGL Shader Overlay ---

const SHADER_VERTEX = `attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}`;

const SHADER_TIMER_START = `
precision highp float;
uniform float t;
uniform vec2 r;
void main(){
  vec4 o=vec4(0);
  vec2 FC=gl_FragCoord.xy;
  for(float z=0.,d=0.,i=0.;i<90.;i++){
    vec3 p=z*normalize(vec3(FC,0.5*r.y)*2.-vec3(r,r.x));
    p=vec3(atan(p.y,p.x),p.z/8.-t,length(p.xy)-9.);
    for(d=0.;d<7.;d++)p+=sin(p.yzx*d+t+i*.2)/d;
    d=.2*length(vec4(.2*cos(6.*p)-.2,p.z));z+=d;
    o+=(cos(p.x+vec4(0,.5,1,0))+1.)/d/z;
  }
  o=tanh(o*o/3e2);
  gl_FragColor=o;
}`;

const SHADER_NIGHT = `
precision highp float;
uniform float t;
uniform vec2 r;
void main(){
  vec4 o=vec4(0);
  vec2 FC=gl_FragCoord.xy;
  for(float i=0.,z=0.,d=0.,s=0.;i<70.;i++){
    vec3 p=z*normalize(vec3(FC,0.5*r.y)*2.-vec3(r,r.x));
    p.z+=9.;
    vec3 a=vec3(.57);
    a=mix(dot(a-=.57,p)*a,p,cos(s-=t))-sin(s)*cross(a,p);
    s=sqrt(length(a.xz-a.y));
    for(d=1.;d<9.;d++)a+=sin(a*d-t).yzx/d;
    d=length(sin(a)+dot(a,a/a)*.2)*s/2e1;z+=d;
    o+=vec4(z,2,s,1)/s/d;
  }
  o=tanh(o/2e3);
  gl_FragColor=o;
}`;

function ShaderOverlay({ fragmentSrc, duration, speed = 1.0, onDone, opacity: maxOpacity = 0.6 }) {
  const canvasRef = useRef(null);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) { onDone?.(); return; }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, SHADER_VERTEX);
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragmentSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn("Shader compile error:", gl.getShaderInfoLog(fs));
      onDone?.();
      return;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

    const tLoc = gl.getUniformLocation(prog, "t");
    const rLoc = gl.getUniformLocation(prog, "r");
    gl.uniform2f(rLoc, canvas.width, canvas.height);

    const start = performance.now();
    let raf;
    const fadeIn = duration * 0.12;
    const fadeOut = duration * 0.2;

    const loop = () => {
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed > duration) { onDone?.(); return; }

      // Fade envelope
      let env = maxOpacity;
      if (elapsed < fadeIn) env = maxOpacity * (elapsed / fadeIn);
      else if (elapsed > duration - fadeOut) env = maxOpacity * ((duration - elapsed) / fadeOut);
      setOpacity(env);

      gl.uniform1f(tLoc, elapsed * speed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fragmentSrc, duration, speed, maxOpacity, onDone]);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none",
      width: "100vw", height: "100vh", opacity,
      transition: "opacity 0.3s ease",
    }} />
  );
}

// --- Level Up Overlay (golden shader + text) ---

function LevelUpOverlay({ rankName, onDone }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <ShaderOverlay fragmentSrc={SHADER_TIMER_START} duration={5} speed={0.4} onDone={onDone} opacity={0.55} />
      <div style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.8rem", fontWeight: 700,
        color: "#d4a843", textAlign: "center", textShadow: "0 0 40px rgba(212,168,67,0.6), 0 0 80px rgba(212,168,67,0.3)",
        animation: "fadeIn 0.8s ease-out both", position: "relative", zIndex: 251,
      }}>
        {rankName}
      </div>
    </div>
  );
}

// --- Night Shader Background ---

function NightShaderBg() {
  return <ShaderOverlay fragmentSrc={SHADER_NIGHT} duration={99999} speed={0.08} opacity={0.25} />;
}

// --- Timer Component (reused, extended with duration prop) ---

function PomodoroTimer({ duration = 1500, onComplete, soundEnabled = true, onTick, intention, timerKey, persist = {} }) {
  const saved = loadTimer();
  const isResume = saved && saved.key === timerKey;

  // Auto-start: if not resuming, start immediately
  const autoStartTime = (!isResume) ? Date.now() + duration * 1000 : null;
  const [endTime, setEndTime] = useState(() => {
    if (isResume && saved.endTime && !saved.paused) return saved.endTime;
    if (autoStartTime) return autoStartTime;
    return null;
  });
  const [pauseRemaining, setPauseRemaining] = useState(() => {
    if (isResume && saved.paused) return saved.pauseRemaining;
    return 0;
  });
  const [running, setRunning] = useState(() => {
    if (isResume) return !saved.paused && saved.endTime > Date.now();
    return true; // auto-start
  });
  const [remaining, setRemaining] = useState(() => {
    if (isResume && saved.endTime && !saved.paused) return Math.max(0, Math.ceil((saved.endTime - Date.now()) / 1000));
    if (isResume && saved.paused) return saved.pauseRemaining;
    return duration;
  });
  // Persist auto-start to localStorage
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!isResume && !autoStarted.current && autoStartTime) {
      autoStarted.current = true;
      saveTimer({ key: timerKey, endTime: autoStartTime, paused: false, pauseRemaining: 0, intention, ...persist });
    }
  }, []);
  const ref = useRef(null);
  const soundPlayed = useRef(false);
  const [showRipple, setShowRipple] = useState(!isResume); // auto-start ripple

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
      document.title = `${mm}:${ss} — ${intention || "Timer"}`;
    } else if (remaining === 0 && intention) {
      document.title = `✓ ${intention} — Health System`;
    }
    return () => { document.title = "Health System"; };
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
    setShowRipple(true);
    saveTimer({ key: timerKey, endTime: et, paused: false, pauseRemaining: 0, intention, ...persist });
  };

  const handlePause = () => {
    clearInterval(ref.current);
    const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    setRunning(false); setEndTime(null); setPauseRemaining(left); setRemaining(left);
    saveTimer({ key: timerKey, endTime: null, paused: true, pauseRemaining: left, intention, ...persist });
  };

  const progress = 1 - remaining / duration;
  const done = remaining === 0;
  const r = 72, size = 180;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", padding: "0.3rem 0 0.8rem" }}>
      {showRipple && <ShaderOverlay fragmentSrc={SHADER_TIMER_START} duration={6.48} speed={0.6} onDone={() => setShowRipple(false)} opacity={0.5} />}
      {intention && (
        <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.05rem", fontWeight: 700, textAlign: "center", lineHeight: 1.3, maxWidth: 280, padding: "0 0.5rem" }}>
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
          <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "2.4rem", fontWeight: 700, color: done ? "var(--done)" : "var(--fg)" }}>
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
          if (s <= 1) { clearInterval(ref.current); setRunning(false); setTimerDone(true); playReturnSound(); return 0; }
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
          <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "1.5rem", fontWeight: 700 }}>
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

function DayLog({ entries, movements, expanded, onToggleExpand, onDeleteEntry }) {
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
  ].sort((a, b) => (b._time || "").localeCompare(a._time || ""));

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
          <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "0.65rem", fontWeight: 700, color: goalReached ? "var(--done)" : "var(--accent)" }}>
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
          <div style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "1.2rem", fontWeight: 700, color: "var(--accent)" }}>{totalMin}</div>
          <div style={{ fontSize: "0.55rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase" }}>Minuten</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "1.2rem", fontWeight: 700 }}>{count}</div>
          <div style={{ fontSize: "0.55rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase" }}>Einträge</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "1.2rem", fontWeight: 700, color: "var(--done)" }}>{movements.length}</div>
          <div style={{ fontSize: "0.55rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase" }}>Bewegung</div>
        </div>
      </div>

      {/* Timeline — show 4, fade, expand */}
      <TimelineList events={events} fmtTime={fmtTime} expanded={expanded} onToggle={onToggleExpand} onDeleteEntry={onDeleteEntry} />
    </div>
  );
}

function TimelineEvent({ ev, fmtTime, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isLog = ev._type === "entry" && !TIMER_TYPES.has(ev.entry_type || "pomodoro");
  if (ev._type === "entry") {
    const typeIcon = TYPE_ICON[ev.entry_type] || "🎯";
    return (
      <div style={{ position: "relative", marginBottom: "0.4rem" }}>
        <div style={{ position: "absolute", left: "-3rem", top: "0.25rem", width: "2.2rem", fontSize: "0.55rem", fontFamily: "'JetBrains Mono', 'SF Mono', monospace", color: "var(--fg-dim)", textAlign: "right" }}>
          {fmtTime(ev._time)}
        </div>
        <div style={{ position: "absolute", left: "-0.85rem", top: "0.35rem", width: 10, height: 10, borderRadius: "50%", background: ev.completed_at ? "var(--accent)" : "var(--border)", border: "2px solid var(--bg)" }} />
        <div style={{ padding: "0.4rem 0.6rem", background: "var(--card-bg)", borderRadius: 6, borderLeft: `3px solid ${ev.project_color || "var(--border)"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.15rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.7rem" }}>{typeIcon}</span>
            <span style={{ fontSize: "0.55rem", fontFamily: "'JetBrains Mono', 'SF Mono', monospace", color: "var(--fg-dim)" }}>{ev.duration_minutes || 25}min</span>
            {ev.project_name && (
              <span style={{ fontSize: "0.5rem", background: `${ev.project_color || "var(--accent)"}20`, color: ev.project_color || "var(--accent)", borderRadius: 3, padding: "0.05rem 0.3rem", fontWeight: 700 }}>
                {ev.project_name}
              </span>
            )}
            {isLog && onDelete && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} style={{
                marginLeft: "auto", background: "transparent", border: "none", color: "var(--fg-dim)",
                cursor: "pointer", fontSize: "0.6rem", padding: "0.1rem 0.2rem", opacity: 0.4,
              }}>×</button>
            )}
            {isLog && confirmDelete && (
              <span style={{ marginLeft: "auto", display: "flex", gap: "0.25rem", alignItems: "center" }}>
                <button onClick={() => onDelete(ev.id)} style={{
                  background: "var(--accent)", color: "#fff", border: "none", borderRadius: 3,
                  fontSize: "0.5rem", padding: "0.15rem 0.35rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                }}>Löschen</button>
                <button onClick={() => setConfirmDelete(false)} style={{
                  background: "transparent", border: "none", color: "var(--fg-dim)",
                  fontSize: "0.5rem", cursor: "pointer", fontFamily: "inherit",
                }}>Abbrechen</button>
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
  return (
    <div style={{ position: "relative", marginBottom: "0.3rem" }}>
      <div style={{ position: "absolute", left: "-3rem", top: "0.1rem", width: "2.2rem", fontSize: "0.52rem", fontFamily: "'JetBrains Mono', 'SF Mono', monospace", color: "var(--fg-dim)", textAlign: "right" }}>
        {fmtTime(ev._time)}
      </div>
      <div style={{ position: "absolute", left: "-0.7rem", top: "0.2rem", width: 6, height: 6, borderRadius: 2, background: "var(--done)" }} />
      <div style={{ fontSize: "0.65rem", color: "var(--done)", fontWeight: 500 }}>
        ↑ {(ev.exercise || "").split(",").join(" + ")}
      </div>
    </div>
  );
}

const PREVIEW_COUNT = 4;

function TimelineList({ events, fmtTime, expanded = false, onToggle, onDeleteEntry }) {
  const hasMore = events.length > PREVIEW_COUNT;
  const visible = expanded ? events : events.slice(0, PREVIEW_COUNT);

  return (
    <div style={{ position: "relative", paddingLeft: "3rem" }}>
      <div style={{ position: "absolute", left: "2.4rem", top: 0, bottom: 0, width: 2, background: "var(--border)", borderRadius: 1 }} />
      {visible.map((ev) => <TimelineEvent key={`${ev._type}-${ev.id || ev._time}`} ev={ev} fmtTime={fmtTime} onDelete={onDeleteEntry} />)}
      {hasMore && !expanded && (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: "-2.5rem", left: "-3rem", right: 0, height: "2.5rem",
            background: "linear-gradient(to bottom, transparent, var(--bg))", pointerEvents: "none" }} />
          <button onClick={() => onToggle && onToggle(true)} style={{
            width: "100%", padding: "0.4rem", background: "transparent", border: "1px solid var(--border)",
            borderRadius: 6, fontSize: "0.65rem", color: "var(--fg-dim)", cursor: "pointer", fontFamily: "inherit",
          }}>
            {events.length - PREVIEW_COUNT} weitere anzeigen
          </button>
        </div>
      )}
      {hasMore && expanded && (
        <button onClick={() => onToggle && onToggle(false)} style={{
          width: "100%", padding: "0.3rem", background: "transparent", border: "none",
          fontSize: "0.6rem", color: "var(--fg-dim)", cursor: "pointer", fontFamily: "inherit",
        }}>
          Einklappen
        </button>
      )}
    </div>
  );
}

// --- Todo List ---

function TodoList({ todos, dayId, openYesterday, onUpdate, expanded, onToggleExpand }) {
  const [newText, setNewText] = useState("");
  const [carriedIds, setCarriedIds] = useState(new Set());

  const handleAdd = async () => {
    if (!newText.trim()) return;
    await api.createTodo(dayId, newText.trim());
    setNewText("");
    onUpdate();
  };

  const handleToggle = async (id, currentDone) => {
    if (currentDone) return; // one-way door: no un-completing
    await api.toggleTodo(id, true);
    playCompletionChime();
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

      {/* Todo items — show 4, fade, expand */}
      {todos.length === 0 && (
        <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--fg-dim)", fontSize: "0.78rem", fontStyle: "italic" }}>Keine Aufgaben.</div>
      )}
      <TodoItemList todos={todos} onToggle={handleToggle} onDelete={handleDelete} expanded={expanded} onExpand={onToggleExpand} />
    </div>
  );
}

function MiniConfetti({ active }) {
  if (!active) return null;
  const particles = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * 360;
    const dist = 28 + Math.random() * 22;
    const size = 3 + Math.random() * 4;
    const colors = ["var(--accent)", "var(--done)", "#d4a843", "#6aafcf", "#a8826a"];
    return { angle, dist, size, color: colors[i % colors.length], delay: Math.random() * 0.2 };
  });
  return (
    <div style={{ position: "absolute", left: -20, top: -20, right: -20, bottom: -20, pointerEvents: "none", zIndex: 5, overflow: "visible" }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: "50%", top: "50%", width: p.size, height: p.size,
          borderRadius: p.size > 4 ? 1 : "50%", background: p.color,
          animation: `todoConfetti 2.7s ease-out ${p.delay}s forwards`,
          "--angle": `${p.angle}deg`, "--dist": `${p.dist}px`,
        }} />
      ))}
    </div>
  );
}

function TodoItem({ t, onToggle, onDelete }) {
  const [celebrating, setCelebrating] = useState(false);
  const handleClick = () => {
    if (t.done) return;
    setCelebrating(true);
    onToggle(t.id, t.done);
    setTimeout(() => setCelebrating(false), 2700);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.3rem", borderBottom: "1px solid var(--border)" }}>
      <div style={{ position: "relative", width: 22, height: 22, flexShrink: 0, overflow: "visible" }}>
        <MiniConfetti active={celebrating} />
        <button onClick={handleClick} style={{
          width: 22, height: 22, borderRadius: 4, border: `2px solid ${t.done ? "var(--done)" : "var(--border)"}`,
          background: t.done ? "var(--done)" : "transparent", cursor: t.done ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: "0.65rem", position: "relative", zIndex: 1,
        }}>
          {t.done ? "✓" : ""}
        </button>
      </div>
      <span style={{
        flex: 1, fontSize: "0.78rem", textDecoration: t.done ? "line-through" : "none",
        color: t.done ? "var(--fg-dim)" : "var(--fg)",
      }}>
        {t.text}
        {t.carried_from_id && <span style={{ fontSize: "0.55rem", color: "var(--fg-dim)", marginLeft: "0.3rem" }}>(gestern)</span>}
      </span>
      {!t.done && (
        <button onClick={() => onDelete(t.id)} style={{
          background: "transparent", border: "none", color: "var(--fg-dim)", cursor: "pointer",
          fontSize: "0.7rem", padding: "0.2rem", opacity: 0.5,
        }}>×</button>
      )}
    </div>
  );
}

function TodoItemList({ todos, onToggle, onDelete, expanded = false, onExpand }) {
  if (todos.length === 0) return null;
  const hasMore = todos.length > PREVIEW_COUNT;
  const visible = expanded ? todos : todos.slice(0, PREVIEW_COUNT);

  return (
    <div style={{ position: "relative" }}>
      {visible.map((t) => <TodoItem key={t.id} t={t} onToggle={onToggle} onDelete={onDelete} />)}
      {hasMore && !expanded && (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: "-2rem", left: 0, right: 0, height: "2rem",
            background: "linear-gradient(to bottom, transparent, var(--bg))", pointerEvents: "none" }} />
          <button onClick={() => onExpand && onExpand(true)} style={{
            width: "100%", padding: "0.4rem", background: "transparent", border: "1px solid var(--border)",
            borderRadius: 6, fontSize: "0.65rem", color: "var(--fg-dim)", cursor: "pointer", fontFamily: "inherit", marginTop: "0.3rem",
          }}>
            {todos.length - PREVIEW_COUNT} weitere anzeigen
          </button>
        </div>
      )}
      {hasMore && expanded && (
        <button onClick={() => onExpand && onExpand(false)} style={{
          width: "100%", padding: "0.3rem", background: "transparent", border: "none",
          fontSize: "0.6rem", color: "var(--fg-dim)", cursor: "pointer", fontFamily: "inherit",
        }}>
          Einklappen
        </button>
      )}
    </div>
  );
}

// --- Collapsible Section ---

function CollapsibleSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
        background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
        padding: "0.3rem 0", marginBottom: open ? "0.4rem" : 0,
      }}>
        <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "0.9rem", fontWeight: 700, color: "var(--fg)" }}>{title}</span>
        <span style={{ fontSize: "0.65rem", color: "var(--fg-dim)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>
      {open && children}
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

  // Entry flow state — restore from active timer if exists
  const savedTimer = loadTimer();
  const [phase, setPhase] = useState(() => {
    if (savedTimer && (savedTimer.endTime || savedTimer.paused)) return "timer";
    return "idle";
  });
  const [entryConfig, setEntryConfig] = useState(() => {
    if (savedTimer && (savedTimer.endTime || savedTimer.paused)) {
      return {
        intention: savedTimer.intention || "", entryType: savedTimer.entryType || "pomodoro",
        duration: savedTimer.duration || 25, projectId: null, tags: [], notes: "",
      };
    }
    return { intention: "", entryType: "pomodoro", duration: 25, projectId: null, tags: [], notes: "", logBiz: null, logEnergy: null };
  });
  const [currentEntryId, setCurrentEntryId] = useState(() => savedTimer?.entryId || null);
  const [showNotes, setShowNotes] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [levelUpRank, setLevelUpRank] = useState(null);
  const prevLevel = useRef(null);
  const [categories, setCategories] = useState([]);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  // Mobile tab
  const [mobileTab, setMobileTab] = useState("timer");
  // Persistent expand states (survive re-renders from loadData)
  const [logExpanded, setLogExpanded] = useState(false);
  const [todosExpanded, setTodosExpanded] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [data, gamHistory, projs, cats] = await Promise.all([
        api.getToday(),
        api.getGamificationHistory(7),
        api.getProjects(),
        api.getCategories(),
      ]);
      setDayData(data);
      setGamification({
        current: data.gamification || { current_rank: 1, streak_length: 0, cumulative_xp: 0 },
        history: gamHistory || [],
      });
      setProjects(projs || []);
      setCategories(cats || []);
      // Sync server timer to localStorage and restore phase
      const st = data.activeTimer;
      if (st && (st.end_time || st.paused)) {
        const synced = syncTimerFromServer(st);
        if (synced) {
          setCurrentEntryId(st.entry_id);
          setEntryConfig((c) => ({ ...c, intention: st.intention || "", entryType: st.entry_type || "pomodoro", duration: Math.round(st.duration_seconds / 60) }));
          setPhase("timer");
        }
      }
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

  // Level-up detection (must be before early return to respect Rules of Hooks)
  const currentLevel = dayData ? getLevelProgress(
    (gamification?.current?.cumulative_xp || 0) +
    calcEffectiveXP(calcDayXPFlex(dayData.pomodoros || [], (dayData.movements || []).length).dayXP, dayData.streakLength || 0) -
    (dayData.day?.effective_xp || 0)
  ).level : 0;
  useEffect(() => {
    if (prevLevel.current !== null && currentLevel > prevLevel.current) {
      setLevelUpRank(getRank(currentLevel).name);
    }
    prevLevel.current = currentLevel;
  }, [currentLevel]);

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

  // Time-of-day awareness
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const isWindDown = h > 21 || (h === 21 && m >= 30); // 21:30+
  const isPastMidnight = h >= 0 && (h < 2 || (h === 2 && m < 30)); // 00:00–02:29
  const isGrayscale = isWindDown || isPastMidnight;

  // --- Action Handlers ---

  // Timer mode: create entry, start timer
  const handleStartEntry = async () => {
    if (!entryConfig.intention.trim()) return;
    const { id } = await api.createEntry(dayData.day.id, entryConfig.intention.trim(), {
      entryType: entryConfig.entryType, durationMinutes: entryConfig.duration,
      projectId: entryConfig.projectId, valueTags: entryConfig.tags, notes: entryConfig.notes,
    });
    setCurrentEntryId(id);
    setPhase("timer");
  };

  // Log mode: create entry, rate, complete — all at once
  const handleLogEntry = async () => {
    if (!entryConfig.intention.trim()) return;
    const { id } = await api.createEntry(dayData.day.id, entryConfig.intention.trim(), {
      entryType: entryConfig.entryType, durationMinutes: entryConfig.duration,
      projectId: entryConfig.projectId, valueTags: entryConfig.tags, notes: entryConfig.notes,
    });
    await api.completePomodoro(id);
    if (entryConfig.logBiz != null || entryConfig.logEnergy != null) {
      await api.ratePomodoro(id, entryConfig.logBiz || 0, entryConfig.logEnergy || 0);
    }
    await loadData();
    setPhase("idle");
    resetConfig();
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
    setEntryConfig({ intention: "", entryType: "pomodoro", duration: 25, projectId: null, tags: [], notes: "", logBiz: null, logEnergy: null });
    setCurrentEntryId(null);
    setShowNotes(false);
    setShowNewProject(false);
    setNewProjectName("");
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const { id } = await api.createProject(newProjectName.trim());
    setEntryConfig((c) => ({ ...c, projectId: id }));
    setNewProjectName("");
    setShowNewProject(false);
    await loadData();
  };

  const handleCreateCategory = async () => {
    if (!newCatLabel.trim()) return;
    const slug = newCatLabel.trim().toLowerCase().replace(/[^a-z0-9äöü]/g, "-").replace(/-+/g, "-");
    await api.createCategory(slug, newCatLabel.trim(), "", "#908c84", "", categories.length + 1);
    setNewCatLabel("");
    setShowNewCat(false);
    await loadData();
  };

  // --- Render ---

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 640;

  const renderTimerPanel = () => (
    <div style={isGrayscale ? { filter: "grayscale(0.85) brightness(0.92)", position: "relative" } : undefined}>
      {isGrayscale && <NightShaderBg />}
      {/* Wind-down banner (21:30–23:59) */}
      {isWindDown && !isPastMidnight && (
        <div style={{ background: "var(--accent)", color: "#fff", padding: "0.5rem 0.8rem", borderRadius: 8, marginBottom: "0.8rem", fontSize: "0.72rem", fontWeight: 600, textAlign: "center" }}>
          Die Stunden vor Mitternacht sind doppelt so viel wert, die danach kosten doppelt so viel. Wind down now.
        </div>
      )}
      {/* Past midnight banner (00:00–02:29) */}
      {isPastMidnight && (
        <div style={{ background: "#2a2a2a", color: "#e0e0e0", padding: "0.8rem 1rem", borderRadius: 8, marginBottom: "0.8rem", fontSize: "0.75rem", fontWeight: 500, textAlign: "center", lineHeight: 1.5 }}>
          Morgen vormittags w&uuml;rdest du bessere Arbeit machen... Schreib was auf und schlaf dann.
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
        <div>
          <div style={{ fontSize: "0.68rem", color: "var(--fg-dim)" }}>
            {now.toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "0.85rem", fontWeight: 700, marginTop: "0.1rem" }}>
            {rank.name} <span style={{ fontSize: "0.65rem", color: "var(--fg-dim)", fontWeight: 400 }}>{rank.title}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "1rem", fontWeight: 700, color: "var(--accent)" }}>{effectiveXP}</div>
            <div style={{ fontSize: "0.5rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase" }}>XP</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "1rem", fontWeight: 700, color: "var(--done)" }}>{totalMinutes}</div>
            <div style={{ fontSize: "0.5rem", color: "var(--fg-dim)", fontWeight: 600, textTransform: "uppercase" }}>min</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: "1rem", fontWeight: 700, color: streak > 0 ? "var(--done)" : "var(--fg-dim)" }}>{streak}</div>
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

      {/* PHASE: Idle — Mode selection */}
      {phase === "idle" && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <button onClick={() => { setPhase("timer_setup"); setEntryConfig((c) => ({ ...c, entryType: "pomodoro", duration: 25 })); }} className="btn-interactive" style={{
            flex: 1, padding: "1rem 0.8rem", borderRadius: 10, border: "2px solid var(--accent)",
            background: "var(--card-bg)", cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem",
          }}>
            <span style={{ fontSize: "1.5rem" }}>🎯</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent)" }}>Timer</span>
            <span style={{ fontSize: "0.6rem", color: "var(--fg-dim)" }}>Fokuszeit starten</span>
          </button>
          <button onClick={() => setPhase("log_setup")} className="btn-interactive" style={{
            flex: 1, padding: "1rem 0.8rem", borderRadius: 10, border: "1px solid var(--border)",
            background: "var(--card-bg)", cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem",
          }}>
            <span style={{ fontSize: "1.5rem" }}>📋</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--fg)" }}>Log-Eintrag</span>
            <span style={{ fontSize: "0.6rem", color: "var(--fg-dim)" }}>Aktivität erfassen</span>
          </button>
        </div>
      )}

      {/* PHASE: Timer Setup */}
      {phase === "timer_setup" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
            <button onClick={() => { setPhase("idle"); resetConfig(); }} style={{ background: "transparent", border: "none", fontSize: "0.8rem", cursor: "pointer", color: "var(--fg-dim)", padding: "0.2rem" }}>←</button>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--accent)" }}>🎯 Timer einrichten</span>
          </div>

          {/* Intention */}
          <div>
            <div style={labelStyle}>Woran arbeitest du?</div>
            <input value={entryConfig.intention} onChange={(e) => setEntryConfig((c) => ({ ...c, intention: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && entryConfig.intention.trim() && handleStartEntry()}
              placeholder="Intention setzen..." style={inputStyle} autoFocus />
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

          {/* Projekt */}
          <div>
            <div style={labelStyle}>Projekt</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
              {projects.map((p) => (
                <button key={p.id} onClick={() => setEntryConfig((c) => ({ ...c, projectId: c.projectId === p.id ? null : p.id }))} className="chip-interactive"
                  style={chipStyle(entryConfig.projectId === p.id, p.color)}>
                  {p.name}
                </button>
              ))}
              {!showNewProject ? (
                <button onClick={() => setShowNewProject(true)} className="chip-interactive" style={{ ...chipStyle(false), fontStyle: "italic", opacity: 0.7 }}>+ Neu</button>
              ) : (
                <div style={{ display: "flex", gap: "0.3rem", width: "100%", marginTop: "0.2rem" }}>
                  <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                    placeholder="Projektname..." style={{ ...inputStyle, fontSize: "0.75rem", flex: 1 }} autoFocus />
                  <button onClick={handleCreateProject} className="btn-interactive" disabled={!newProjectName.trim()}
                    style={{ ...btnStyle(newProjectName.trim() ? "var(--accent)" : "var(--muted)", newProjectName.trim() ? "#fff" : "var(--fg-dim)", "0.72rem"), padding: "0.4rem 0.7rem", opacity: newProjectName.trim() ? 1 : 0.5 }}>
                    Erstellen
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Kategorie */}
          <div>
            <div style={labelStyle}>Worauf zahlt das ein?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
              {categories.map((cat) => (
                <button key={cat.slug} onClick={() => setEntryConfig((c) => ({
                  ...c, tags: c.tags.includes(cat.slug) ? c.tags.filter((t) => t !== cat.slug) : [...c.tags, cat.slug],
                }))} className="chip-interactive" style={chipStyle(entryConfig.tags.includes(cat.slug), cat.color)}>
                  {cat.icon} {cat.label}
                </button>
              ))}
              {!showNewCat ? (
                <button onClick={() => setShowNewCat(true)} className="chip-interactive" style={{ ...chipStyle(false), fontStyle: "italic", opacity: 0.7 }}>+ Neu</button>
              ) : (
                <div style={{ display: "flex", gap: "0.3rem", width: "100%", marginTop: "0.2rem" }}>
                  <input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                    placeholder="Kategoriename..." style={{ ...inputStyle, fontSize: "0.75rem", flex: 1 }} autoFocus />
                  <button onClick={handleCreateCategory} className="btn-interactive" disabled={!newCatLabel.trim()}
                    style={{ ...btnStyle(newCatLabel.trim() ? "var(--accent)" : "var(--muted)", newCatLabel.trim() ? "#fff" : "var(--fg-dim)", "0.72rem"), padding: "0.4rem 0.7rem", opacity: newCatLabel.trim() ? 1 : 0.5 }}>
                    Erstellen
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Timer starten */}
          <button onClick={handleStartEntry} className="btn-interactive" disabled={!entryConfig.intention.trim()} style={{
            ...btnStyle(entryConfig.intention.trim() ? "var(--accent)" : "var(--muted)", entryConfig.intention.trim() ? "#fff" : "var(--fg-dim)"),
            width: "100%", marginTop: "0.3rem", padding: "0.7rem 1.4rem", fontSize: "0.9rem",
            opacity: entryConfig.intention.trim() ? 1 : 0.5,
          }}>
            Timer starten ({entryConfig.duration} min)
          </button>
        </div>
      )}

      {/* PHASE: Log Setup — alles auf einmal: Was, Typ, Dauer, Bewertung */}
      {phase === "log_setup" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
            <button onClick={() => { setPhase("idle"); resetConfig(); }} style={{ background: "transparent", border: "none", fontSize: "0.8rem", cursor: "pointer", color: "var(--fg-dim)", padding: "0.2rem" }}>←</button>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--fg)" }}>📋 Aktivität erfassen</span>
          </div>

          {/* Typ */}
          <div>
            <div style={labelStyle}>Art der Aktivität</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
              {ENTRY_TYPES.map((t) => (
                <button key={t.value} onClick={() => setEntryConfig((c) => ({ ...c, entryType: t.value }))} className="chip-interactive"
                  style={chipStyle(entryConfig.entryType === t.value)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Was */}
          <div>
            <div style={labelStyle}>Was hast du gemacht?</div>
            <input value={entryConfig.intention} onChange={(e) => setEntryConfig((c) => ({ ...c, intention: e.target.value }))}
              placeholder="Beschreibung..." style={inputStyle} autoFocus />
          </div>

          {/* Dauer */}
          <div>
            <div style={labelStyle}>Wie lange?</div>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {DURATION_OPTIONS.map((d) => (
                <button key={d.value} onClick={() => setEntryConfig((c) => ({ ...c, duration: d.value }))} className="chip-interactive"
                  style={{ ...chipStyle(entryConfig.duration === d.value), flex: 1, textAlign: "center", padding: "0.4rem 0.3rem" }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Projekt */}
          <div>
            <div style={labelStyle}>Projekt</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
              {projects.map((p) => (
                <button key={p.id} onClick={() => setEntryConfig((c) => ({ ...c, projectId: c.projectId === p.id ? null : p.id }))} className="chip-interactive"
                  style={chipStyle(entryConfig.projectId === p.id, p.color)}>
                  {p.name}
                </button>
              ))}
              {!showNewProject ? (
                <button onClick={() => setShowNewProject(true)} className="chip-interactive" style={{ ...chipStyle(false), fontStyle: "italic", opacity: 0.7 }}>+ Neu</button>
              ) : (
                <div style={{ display: "flex", gap: "0.3rem", width: "100%", marginTop: "0.2rem" }}>
                  <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                    placeholder="Projektname..." style={{ ...inputStyle, fontSize: "0.75rem", flex: 1 }} autoFocus />
                  <button onClick={handleCreateProject} className="btn-interactive" disabled={!newProjectName.trim()}
                    style={{ ...btnStyle(newProjectName.trim() ? "var(--accent)" : "var(--muted)", newProjectName.trim() ? "#fff" : "var(--fg-dim)", "0.72rem"), padding: "0.4rem 0.7rem", opacity: newProjectName.trim() ? 1 : 0.5 }}>
                    Erstellen
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Kategorie */}
          <div>
            <div style={labelStyle}>Worauf zahlt das ein?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
              {categories.map((cat) => (
                <button key={cat.slug} onClick={() => setEntryConfig((c) => ({
                  ...c, tags: c.tags.includes(cat.slug) ? c.tags.filter((t) => t !== cat.slug) : [...c.tags, cat.slug],
                }))} className="chip-interactive" style={chipStyle(entryConfig.tags.includes(cat.slug), cat.color)}>
                  {cat.icon} {cat.label}
                </button>
              ))}
              {!showNewCat ? (
                <button onClick={() => setShowNewCat(true)} className="chip-interactive" style={{ ...chipStyle(false), fontStyle: "italic", opacity: 0.7 }}>+ Neu</button>
              ) : (
                <div style={{ display: "flex", gap: "0.3rem", width: "100%", marginTop: "0.2rem" }}>
                  <input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                    placeholder="Kategoriename..." style={{ ...inputStyle, fontSize: "0.75rem", flex: 1 }} autoFocus />
                  <button onClick={handleCreateCategory} className="btn-interactive" disabled={!newCatLabel.trim()}
                    style={{ ...btnStyle(newCatLabel.trim() ? "var(--accent)" : "var(--muted)", newCatLabel.trim() ? "#fff" : "var(--fg-dim)", "0.72rem"), padding: "0.4rem 0.7rem", opacity: newCatLabel.trim() ? 1 : 0.5 }}>
                    Erstellen
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Geschäftswert */}
          <div>
            <div style={labelStyle}>Geschäftswert</div>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              {BIZ_LEVELS.map((lvl) => (
                <button key={lvl.value} onClick={() => setEntryConfig((c) => ({ ...c, logBiz: c.logBiz === lvl.value ? null : lvl.value }))} className="chip-interactive" style={{
                  flex: 1, padding: "0.4rem 0.2rem", borderRadius: 6, fontSize: "0.65rem", fontFamily: "inherit",
                  border: entryConfig.logBiz === lvl.value ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: entryConfig.logBiz === lvl.value ? "rgba(196,77,43,0.12)" : "transparent",
                  color: entryConfig.logBiz === lvl.value ? "var(--accent)" : "var(--fg-dim)", cursor: "pointer",
                  fontWeight: entryConfig.logBiz === lvl.value ? 700 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                }}>
                  <span style={{ fontSize: "0.8rem" }}>{lvl.icon}</span><span>{lvl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Energie */}
          <div>
            <div style={labelStyle}>Energie-Bilanz</div>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              {ENERGY_LEVELS.map((lvl) => (
                <button key={lvl.value} onClick={() => setEntryConfig((c) => ({ ...c, logEnergy: c.logEnergy === lvl.value ? null : lvl.value }))} className="chip-interactive" style={{
                  flex: 1, padding: "0.4rem 0.2rem", borderRadius: 6, fontSize: "0.65rem", fontFamily: "inherit",
                  border: entryConfig.logEnergy === lvl.value ? "2px solid var(--done)" : "1px solid var(--border)",
                  background: entryConfig.logEnergy === lvl.value ? "rgba(45,138,78,0.12)" : "transparent",
                  color: entryConfig.logEnergy === lvl.value ? "var(--done)" : "var(--fg-dim)", cursor: "pointer",
                  fontWeight: entryConfig.logEnergy === lvl.value ? 700 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                }}>
                  <span style={{ fontSize: "0.8rem" }}>{lvl.icon}</span><span>{lvl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notiz */}
          <div>
            <div style={labelStyle}>Notiz (optional)</div>
            <input value={entryConfig.notes} onChange={(e) => setEntryConfig((c) => ({ ...c, notes: e.target.value }))}
              placeholder="Optional..." style={{ ...inputStyle, fontSize: "0.78rem" }} />
          </div>

          {/* Log Button */}
          <button onClick={handleLogEntry} className="btn-interactive" disabled={!entryConfig.intention.trim()} style={{
            ...btnStyle(entryConfig.intention.trim() ? "var(--fg)" : "var(--muted)", entryConfig.intention.trim() ? "var(--bg)" : "var(--fg-dim)"),
            width: "100%", marginTop: "0.3rem", padding: "0.65rem 1.4rem",
            opacity: entryConfig.intention.trim() ? 1 : 0.5,
          }}>
            Eintrag loggen ({entryConfig.duration} min)
          </button>
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
          persist={{ entryId: currentEntryId, entryType: entryConfig.entryType, duration: entryConfig.duration }}
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

  const handleDeleteEntry = async (id) => {
    await api.deleteEntry(id);
    await loadData();
  };

  const renderLogPanel = () => (
    <DayLog entries={entries} movements={movements} expanded={logExpanded} onToggleExpand={setLogExpanded} onDeleteEntry={handleDeleteEntry} />
  );

  const renderTodosPanel = () => (
    <TodoList todos={dayData.todos || []} dayId={dayData.day.id} openYesterday={dayData.openTodosYesterday || []} onUpdate={loadData} expanded={todosExpanded} onToggleExpand={setTodosExpanded} />
  );

  const tabs = [
    { id: "timer", label: "Timer" },
    { id: "log", label: `Log (${entries.filter((e) => e.completed_at).length})` },
    { id: "todos", label: `Todos (${(dayData.todos || []).filter((t) => !t.done).length})` },
  ];

  return (
    <div style={{ ...pageStyle(theme), maxWidth: isDesktop ? 800 : 480 }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      {levelUpRank && <LevelUpOverlay rankName={levelUpRank} onDone={() => setLevelUpRank(null)} />}

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
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <CollapsibleSection title={`Tageslog (${entries.filter((e) => e.completed_at).length})`} defaultOpen={true}>
              {renderLogPanel()}
            </CollapsibleSection>
            <CollapsibleSection title={`Todos (${(dayData.todos || []).filter((t) => !t.done).length} offen)`} defaultOpen={true}>
              {renderTodosPanel()}
            </CollapsibleSection>
          </div>
        </div>
      )}
    </div>
  );
}
