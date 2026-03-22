import { useState, useEffect } from "react";
import HealthTracker from "./HealthTracker.jsx";
import Dashboard from "./Dashboard.jsx";
import { useSettings } from "./useSettings.js";

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

  // Tick: read localStorage and compute remaining
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
        } else {
          setInfo(null);
        }
      } catch { setInfo(null); }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  return info;
}

function TimerBanner({ timerInfo, onClickBack }) {
  if (!timerInfo || timerInfo.seconds <= 0) return null;
  const mm = String(Math.floor(timerInfo.seconds / 60)).padStart(2, "0");
  const ss = String(timerInfo.seconds % 60).padStart(2, "0");

  return (
    <div
      onClick={onClickBack}
      style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.5rem 1rem",
        background: timerInfo.running
          ? "linear-gradient(135deg, var(--accent), #a03820)"
          : "var(--muted)",
        color: timerInfo.running ? "#fff" : "var(--fg)",
        cursor: "pointer",
        maxWidth: 480, margin: "0 auto",
        borderRadius: "0 0 10px 10px",
        fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
        transition: "background 0.3s ease",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {timerInfo.intention && (
          <div style={{
            fontSize: "0.82rem", fontWeight: 700,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {timerInfo.intention}
          </div>
        )}
        <div style={{
          fontSize: "0.6rem", fontWeight: 500,
          opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {timerInfo.running ? "fokus" : "pausiert"}
        </div>
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "1.3rem", fontWeight: 700,
        letterSpacing: "0.02em",
        flexShrink: 0,
        marginLeft: "0.8rem",
      }}>
        {mm}:{ss}
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
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet" />

      {/* Global timer banner — visible on ALL views except timer view */}
      {view !== "timer" && (
        <TimerBanner timerInfo={globalTimer} onClickBack={() => setView("timer")} />
      )}

      {view === "dashboard" ? (
        <Dashboard onBack={() => setView("timer")} theme={theme} settings={settings} onSettingsChange={updateSettings} />
      ) : (
        <HealthTracker
          onDashboard={() => setView("dashboard")}
          theme={theme}
          settings={settings}
          onSettingsChange={updateSettings}
        />
      )}
    </div>
  );
}
