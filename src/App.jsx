import { useState, useEffect } from "react";
import HealthTracker from "./HealthTracker.jsx";
import Dashboard from "./Dashboard.jsx";
import ProjectSettings from "./ProjectSettings.jsx";
import CategorySettings from "./CategorySettings.jsx";
import { useSettings } from "./useSettings.js";
import { footerBtn } from "./constants.js";

const LIGHT = {
  "--fg": "#2c2825", "--fg-dim": "#8a8480", "--bg": "#f8f6f3", "--card-bg": "#ffffff",
  "--border": "#e8e4de", "--muted": "#f1ede8", "--accent": "#c44d2b",
  "--done": "#3a8a56", "--done-bg": "#f0f7f2",
  "--nav-bg": "rgba(248,246,243,0.92)",
};

const DARK = {
  "--fg": "#e5e0db", "--fg-dim": "#7a7672", "--bg": "#161514", "--card-bg": "#1f1e1c",
  "--border": "#2e2c29", "--muted": "#242220", "--accent": "#d9603a",
  "--done": "#4aad66", "--done-bg": "#1a2a1f",
  "--nav-bg": "rgba(22,21,20,0.92)",
};

const TIMER_KEY = "health-active-timer";

function useGlobalTimer() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    const tick = () => {
      try {
        const raw = localStorage.getItem(TIMER_KEY);
        if (!raw) { setInfo(null); document.title = "Health System"; return; }
        const saved = JSON.parse(raw);
        if (saved.paused) {
          setInfo({ seconds: saved.pauseRemaining, running: false, intention: saved.intention });
          const mm = String(Math.floor(saved.pauseRemaining / 60)).padStart(2, "0");
          const ss = String(saved.pauseRemaining % 60).padStart(2, "0");
          document.title = `⏸ ${mm}:${ss} — ${saved.intention || "Timer"} `;
        } else if (saved.endTime) {
          const left = Math.max(0, Math.ceil((saved.endTime - Date.now()) / 1000));
          setInfo({ seconds: left, running: left > 0, intention: saved.intention });
          if (left <= 0) { localStorage.removeItem(TIMER_KEY); document.title = "Health System"; }
          else {
            const mm = String(Math.floor(left / 60)).padStart(2, "0");
            const ss = String(left % 60).padStart(2, "0");
            document.title = `${mm}:${ss} — ${saved.intention || "Timer"} `;
          }
        } else { setInfo(null); document.title = "Health System"; }
      } catch { setInfo(null); }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);
  return info;
}

function TimerBanner({ timerInfo, onClick }) {
  if (!timerInfo || timerInfo.seconds <= 0) return null;
  const mm = String(Math.floor(timerInfo.seconds / 60)).padStart(2, "0");
  const ss = String(timerInfo.seconds % 60).padStart(2, "0");
  return (
    <div onClick={onClick} style={{
      position: "sticky", top: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0.5rem 1rem",
      background: timerInfo.running ? "linear-gradient(135deg, var(--accent), #a03820)" : "var(--muted)",
      color: timerInfo.running ? "#fff" : "var(--fg)",
      cursor: "pointer", maxWidth: 480, margin: "0 auto",
      borderRadius: "0 0 10px 10px", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      transition: "background 0.3s ease",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {timerInfo.intention && (
          <div style={{ fontSize: "0.82rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {timerInfo.intention}
          </div>
        )}
        <div style={{ fontSize: "0.6rem", fontWeight: 500, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {timerInfo.running ? "fokus" : "pausiert"}
        </div>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.3rem", fontWeight: 700, letterSpacing: "0.02em", flexShrink: 0, marginLeft: "0.8rem" }}>
        {mm}:{ss}
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "timer", label: "Timer" },
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "projects", label: "📁 Projekte" },
  { id: "categories", label: "🏷️ Kategorien" },
];

function TopNav({ view, setView, settings, onSettingsChange }) {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 90,
      background: "var(--nav-bg, var(--bg))",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      padding: "0.35rem 0.8rem",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.2rem",
        maxWidth: 800, margin: "0 auto",
      }}>
        {NAV_ITEMS.map((item) => (
          <button key={item.id} onClick={() => setView(item.id)} className="btn-interactive" style={{
            background: view === item.id ? "var(--accent)" : "transparent",
            color: view === item.id ? "#fff" : "var(--fg-dim)",
            border: "none", borderRadius: 6,
            padding: "0.38rem 0.65rem", fontSize: "0.65rem", fontWeight: view === item.id ? 700 : 500,
            cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "0.01em",
          }}>
            {item.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => onSettingsChange({ soundEnabled: !settings.soundEnabled })} className="btn-interactive" style={{
          background: "transparent", border: "none", fontSize: "0.75rem", cursor: "pointer", padding: "0.3rem",
          opacity: 0.7, transition: "opacity 0.15s",
        }}>
          {settings.soundEnabled ? "🔊" : "🔇"}
        </button>
        <button onClick={() => onSettingsChange({ darkMode: !settings.darkMode })} className="btn-interactive" style={{
          background: "transparent", border: "none", fontSize: "0.75rem", cursor: "pointer", padding: "0.3rem",
          opacity: 0.7, transition: "opacity 0.15s",
        }}>
          {settings.darkMode ? "☀️" : "🌙"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("timer");
  const [settings, updateSettings] = useSettings();
  const globalTimer = useGlobalTimer();

  const theme = settings.darkMode ? DARK : LIGHT;

  useEffect(() => {
    document.body.style.background = theme["--bg"];
    document.documentElement.style.background = theme["--bg"];
  }, [theme]);

  return (
    <div style={{ ...theme }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.3s ease-out both; }
        .btn-interactive { transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1); }
        .btn-interactive:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .btn-interactive:active { transform: scale(0.97) translateY(0); }
        .btn-interactive:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .chip-interactive { transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); }
        .chip-interactive:hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
        .chip-interactive:active { transform: scale(0.96); }
        .chip-interactive:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
        .card-interactive { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .card-interactive:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
        input:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
        input::placeholder { color: var(--fg-dim); opacity: 0.6; }
      `}</style>

      {/* Top navigation */}
      <TopNav view={view} setView={setView} settings={settings} onSettingsChange={updateSettings} />

      {/* Timer banner on non-timer views */}
      {view !== "timer" && <TimerBanner timerInfo={globalTimer} onClick={() => setView("timer")} />}

      {/* Views */}
      {view === "timer" && (
        <HealthTracker theme={theme} settings={settings} onSettingsChange={updateSettings} />
      )}
      {view === "dashboard" && (
        <Dashboard theme={theme} />
      )}
      {view === "projects" && (
        <ProjectSettings theme={theme} />
      )}
      {view === "categories" && (
        <CategorySettings theme={theme} />
      )}
    </div>
  );
}
