import { useState, useCallback } from "react";

const STORAGE_KEY = "health-settings";

const defaults = {
  darkMode: false,
  soundEnabled: true,
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return [settings, update];
}

// Play a warm 432 Hz notification with gentle fade and octave
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;

    // Grundton: 432 Hz, sanftes Ein- und Ausklingen
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 432;
    osc1.type = "sine";
    gain1.gain.setValueAtTime(0.001, t);
    gain1.gain.exponentialRampToValueAtTime(0.25, t + 0.15);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc1.start(t);
    osc1.stop(t + 0.95);

    // Oktave: 864 Hz, leicht versetzt, etwas leiser
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 864;
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.001, t + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.15, t + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    osc2.start(t + 0.12);
    osc2.stop(t + 1.15);
  } catch {
    // Audio not available
  }
}
