function getCredentials() {
  return localStorage.getItem("health-auth") || "";
}

function headers() {
  const cred = getCredentials();
  const h = { "Content-Type": "application/json" };
  if (cred) h.Authorization = `Basic ${cred}`;
  return h;
}

async function request(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...headers(), ...options.headers } });
  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  return res.json();
}

export function setAuth(user, pass) {
  localStorage.setItem("health-auth", btoa(`${user}:${pass}`));
}

export function getAuth() {
  return localStorage.getItem("health-auth");
}

export function clearAuth() {
  localStorage.removeItem("health-auth");
}

export async function testAuth() {
  try {
    await request("/api/today");
    return true;
  } catch {
    return false;
  }
}

export const api = {
  getToday: () => request("/api/today"),

  // Categories
  getCategories: () => request("/api/categories"),
  getAllCategories: () => request("/api/categories?all=1"),
  createCategory: (slug, label, icon, color, description, sortOrder) =>
    request("/api/categories", { method: "POST", body: JSON.stringify({ slug, label, icon, color, description, sort_order: sortOrder }) }),
  updateCategory: (id, data) =>
    request(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Projects
  getProjects: () => request("/api/projects"),

  createProject: (name, color, client, description, defaultValueCategory) =>
    request("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, color, client, description, default_value_category: defaultValueCategory }),
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

  // Retro pomodoros (gap audit)
  createRetroPomodoros: (entries) =>
    request("/api/pomodoros/retro", {
      method: "POST",
      body: JSON.stringify({ entries }),
    }),

  // Movements
  createMovement: (dayId, blockIndex, type, exercise, durationSeconds) =>
    request("/api/movements", {
      method: "POST",
      body: JSON.stringify({ day_id: dayId, block_index: blockIndex, type, exercise, duration_seconds: durationSeconds }),
    }),

  // Day points & gamification
  updateDayPoints: (dayId, totalPoints, dayXP, effectiveXP, streakDay, rankLevel) =>
    request(`/api/days/${dayId}/points`, {
      method: "PATCH",
      body: JSON.stringify({ total_points: totalPoints, day_xp: dayXP, effective_xp: effectiveXP, streak_day: streakDay, rank_level: rankLevel }),
    }),

  upsertGamification: (data) =>
    request("/api/gamification", { method: "PUT", body: JSON.stringify(data) }),

  getGamificationHistory: (days = 7) =>
    request(`/api/gamification/history?days=${days}`),

  getWeekSummary: () => request("/api/week"),

  getCalendar: (month) => request(`/api/calendar?month=${month || new Date().toISOString().slice(0, 7)}`),

  getRecentDays: (count = 7) => request(`/api/days/recent?count=${count}`),
};
