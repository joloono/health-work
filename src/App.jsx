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

export default function App() {
  const [view, setView] = useState("timer");
  const [settings, updateSettings] = useSettings();

  const theme = settings.darkMode ? DARK : LIGHT;

  // Sync body background for full-viewport dark mode
  useEffect(() => {
    document.body.style.background = theme["--bg"];
    document.documentElement.style.background = theme["--bg"];
  }, [theme]);

  if (view === "dashboard") {
    return <Dashboard onBack={() => setView("timer")} theme={theme} settings={settings} onSettingsChange={updateSettings} />;
  }

  return <HealthTracker onDashboard={() => setView("dashboard")} theme={theme} settings={settings} onSettingsChange={updateSettings} />;
}
