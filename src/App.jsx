import { useState, useEffect } from "react";
import HealthTracker from "./HealthTracker.jsx";
import Dashboard from "./Dashboard.jsx";
import ProjectSettings from "./ProjectSettings.jsx";
import CategorySettings from "./CategorySettings.jsx";
import Login from "./Login.jsx";
import { useSettings } from "./useSettings.js";
import { footerBtn } from "./constants.js";
import { getAuth, testAuth, clearAuth } from "./api.js";

const LIGHT = {
  "--fg": "#1a1a1a", "--fg-dim": "#888", "--bg": "#fafaf8", "--card-bg": "#fff",
  "--border": "#e5e3df", "--muted": "#f0eeeb", "--accent": "#c44d2b",
  "--done": "#2d8a4e", "--done-bg": "#f0f8f3",
};

const DARK = {
  "--fg": "#e8e6e3", "--fg-dim": "#888", "--bg": "#141413", "--card-bg": "#1e1e1c",
  "--border": "#333330", "--muted": "#252523", "--accent": "#e0663f",
  "--done": "#3aad62", "--done-bg": "#1a2e20",
};

const TIMER_KEY = "health-active-timer";

function useGlobalTimer() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    const tick = () => {
      try {
        const raw = localStorage.getItem(TIMER_KEY);
        if (!raw) { setInfo(null); return; }
        const saved = JSON.parse(raw);
        if (saved.paused) {
          setInfo({ seconds: saved.pauseRemaining, running: false, intention: saved.intention });
        } else if (saved.endTime) {
          const left = Math.max(0, Math.ceil((saved.endTime - Date.now()) / 1000));
          setInfo({ seconds: left, running: left > 0, intention: saved.intention });
          if (left <= 0) localStorage.removeItem(TIMER_KEY);
        } else { setInfo(null); }
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
  { id: "timer", label: "🏛️ Timer" },
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "projects", label: "📁 Projekte" },
  { id: "categories", label: "🏷️ Kategorien" },
];

function FooterNav({ view, setView, settings, onSettingsChange }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center",
      gap: "0.35rem", padding: "1rem 0 0.5rem",
      maxWidth: 480, margin: "0 auto",
    }}>
      {NAV_ITEMS.map((item) => (
        <button key={item.id} onClick={() => setView(item.id)} style={{
          ...footerBtn,
          background: view === item.id ? "var(--accent)" : "transparent",
          color: view === item.id ? "#fff" : "var(--fg-dim)",
          border: view === item.id ? "1px solid var(--accent)" : "1px solid var(--border)",
          fontWeight: view === item.id ? 700 : 500,
        }}>
          {item.label}
        </button>
      ))}
      <button onClick={() => onSettingsChange({ darkMode: !settings.darkMode })} style={footerBtn}>
        {settings.darkMode ? "☀️" : "🌙"}
      </button>
      <button onClick={() => onSettingsChange({ soundEnabled: !settings.soundEnabled })} style={footerBtn}>
        {settings.soundEnabled ? "🔊" : "🔇"}
      </button>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("timer");
  const [settings, updateSettings] = useSettings();
  const globalTimer = useGlobalTimer();
  const [authed, setAuthed] = useState(!!getAuth());
  const [authChecked, setAuthChecked] = useState(false);

  const theme = settings.darkMode ? DARK : LIGHT;

  useEffect(() => {
    document.body.style.background = theme["--bg"];
    document.documentElement.style.background = theme["--bg"];
  }, [theme]);

  // Verify stored credentials on mount
  useEffect(() => {
    if (getAuth()) {
      testAuth().then((ok) => { setAuthed(ok); if (!ok) clearAuth(); setAuthChecked(true); });
    } else {
      setAuthChecked(true);
    }
  }, []);

  if (!authChecked) return null;
  if (!authed) return <Login theme={theme} onSuccess={() => setAuthed(true)} />;

  return (
    <div style={{ ...theme }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet" />

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

      {/* Global footer navigation */}
      <FooterNav view={view} setView={setView} settings={settings} onSettingsChange={updateSettings} />
    </div>
  );
}
