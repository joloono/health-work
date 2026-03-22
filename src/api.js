const credentials = localStorage.getItem("health-auth") || btoa("jo:health2026");

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${credentials}`,
  };
}

async function request(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...headers(), ...options.headers } });
  if (res.status === 401) {
    localStorage.removeItem("health-auth");
    window.location.reload();
    throw new Error("Unauthorized");
  }
  return res.json();
}

export function setAuth(user, pass) {
  localStorage.setItem("health-auth", btoa(`${user}:${pass}`));
  window.location.reload();
}

export function getAuth() {
  return localStorage.getItem("health-auth");
}

export const api = {
  getToday: () => request("/api/today"),

  createPomodoro: (dayId, blockIndex, pomIndex, intention, valueTags) =>
    request("/api/pomodoros", {
      method: "POST",
      body: JSON.stringify({ day_id: dayId, block_index: blockIndex, pom_index: pomIndex, intention, value_tags: valueTags }),
    }),

  completePomodoro: (id) =>
    request(`/api/pomodoros/${id}/complete`, { method: "PATCH" }),

  createMovement: (dayId, blockIndex, type, exercise, durationSeconds) =>
    request("/api/movements", {
      method: "POST",
      body: JSON.stringify({ day_id: dayId, block_index: blockIndex, type, exercise, duration_seconds: durationSeconds }),
    }),

  updateDayPoints: (dayId, totalPoints, streakDay, rankLevel) =>
    request(`/api/days/${dayId}/points`, {
      method: "PATCH",
      body: JSON.stringify({ total_points: totalPoints, streak_day: streakDay, rank_level: rankLevel }),
    }),

  upsertGamification: (data) =>
    request("/api/gamification", { method: "PUT", body: JSON.stringify(data) }),

  getGamificationHistory: (days = 7) =>
    request(`/api/gamification/history?days=${days}`),

  getWeekSummary: () => request("/api/week"),

  getRecentDays: (count = 7) => request(`/api/days/recent?count=${count}`),
};
