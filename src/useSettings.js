import { useState, useCallback } from "react";

const STORAGE_KEY = "health-settings";

const defaults = {
  darkMode: false,
  soundEnabled: true,
  nordstern: "",
  identity: "",
  motivators: "",
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

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 432;
    osc1.type = "sine";
    gain1.gain.setValueAtTime(0.001, t);
    gain1.gain.exponentialRampToValueAtTime(0.25, t + 0.2);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    osc1.start(t);
    osc1.stop(t + 2.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 864;
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.001, t + 1.0);
    gain2.gain.exponentialRampToValueAtTime(0.15, t + 1.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
    osc2.start(t + 1.0);
    osc2.stop(t + 3.3);
  } catch {}
}

// Reverse: Oktave zuerst, dann Grundton (nach Bewegungspause)
export function playReturnSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 864;
    osc1.type = "sine";
    gain1.gain.setValueAtTime(0.001, t);
    gain1.gain.exponentialRampToValueAtTime(0.15, t + 0.2);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    osc1.start(t);
    osc1.stop(t + 2.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 432;
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.001, t + 1.0);
    gain2.gain.exponentialRampToValueAtTime(0.25, t + 1.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
    osc2.start(t + 1.0);
    osc2.stop(t + 3.3);
  } catch {}
}

// Soft completion chime for todo cross-off: only 432 Hz, 2.7x longer
export function playCompletionChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 432;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 5.9);
    osc.start(t);
    osc.stop(t + 6.0);
  } catch {}
}
