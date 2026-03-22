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

  // Projects
  getProjects: () => request("/api/projects"),

  createProject: (name, color, client) =>
    request("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, color, client }),
    }),

  updateProject: (id, data) =>
    request(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Pomodoros
  createPomodoro: (dayId, blockIndex, pomIndex, intention, valueTags, projectId) =>
    request("/api/pomodoros", {
      method: "POST",
      body: JSON.stringify({ day_id: dayId, block_index: blockIndex, pom_index: pomIndex, intention, value_tags: valueTags, project_id: projectId }),
    }),

  completePomodoro: (id) =>
    request(`/api/pomodoros/${id}/complete`, { method: "PATCH" }),

  ratePomodoro: (id, bizRating, energyRating) =>
    request(`/api/pomodoros/${id}/rate`, {
      method: "PATCH",
      body: JSON.stringify({ biz_rating: bizRating, energy_rating: energyRating }),
    }),

  // Movements
  createMovement: (dayId, blockIndex, type, exercise, durationSeconds) =>
    request("/api/movements", {
      method: "POST",
      body: JSON.stringify({ day_id: dayId, block_index: blockIndex, type, exercise, duration_seconds: durationSeconds }),
    }),

  // Day points & gamification
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
