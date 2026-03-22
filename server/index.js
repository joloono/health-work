const express = require("express");
const path = require("path");
const cors = require("cors");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;
const USER = process.env.AUTH_USER || "jo";
const PASS = process.env.AUTH_PASS || "health2026";

// --- Middleware ---

app.use(express.json());

// Basic Auth
app.use((req, res, next) => {
  // Skip auth in dev for Vite proxy
  if (process.env.NODE_ENV !== "production" && req.headers["x-skip-auth"]) {
    return next();
  }
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Health System"');
    return res.status(401).json({ error: "Unauthorized" });
  }
  const [user, pass] = Buffer.from(auth.split(" ")[1], "base64")
    .toString()
    .split(":");
  if (user === USER && pass === PASS) return next();
  res.set("WWW-Authenticate", 'Basic realm="Health System"');
  return res.status(401).json({ error: "Unauthorized" });
});

// CORS for dev
if (process.env.NODE_ENV !== "production") {
  app.use(cors());
}

// --- API Routes ---

// Get or create today's day record
app.get("/api/today", (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  let day = db.getDay(today);
  if (!day) {
    db.createDay(today);
    day = db.getDay(today);
  }
  const pomodoros = db.getPomodorosByDay(day.id);
  const movements = db.getMovementsByDay(day.id);
  const gamification = db.getGamification(today);
  const lastCompleted = db.getLastCompletedTime(day.id);
  res.json({ day, pomodoros, movements, gamification, lastCompleted });
});

// --- Projects ---

app.get("/api/projects", (req, res) => {
  const projects = req.query.all ? db.getAllProjects() : db.getActiveProjects();
  res.json(projects);
});

app.post("/api/projects", (req, res) => {
  const { name, color, client, description, default_value_category } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const id = db.createProject(name, color, client, description, default_value_category);
  res.json({ id });
});

app.patch("/api/projects/:id", (req, res) => {
  const { name, description, color, default_value_category, client, active } = req.body;
  db.updateProject(req.params.id, name, description, color, default_value_category, client, active);
  res.json({ ok: true });
});

// --- Pomodoros ---

app.post("/api/pomodoros", (req, res) => {
  const { day_id, block_index, pom_index, intention, value_tags, project_id } = req.body;
  const id = db.createPomodoro(day_id, block_index, pom_index, intention, value_tags, project_id);
  res.json({ id });
});

app.patch("/api/pomodoros/:id/complete", (req, res) => {
  db.completePomodoro(req.params.id);
  res.json({ ok: true });
});

app.patch("/api/pomodoros/:id/rate", (req, res) => {
  const { biz_rating, energy_rating } = req.body;
  db.ratePomodoro(req.params.id, biz_rating, energy_rating);
  res.json({ ok: true });
});

// Retro pomodoros (gap audit) — batch insert
app.post("/api/pomodoros/retro", (req, res) => {
  const { entries } = req.body; // [{day_id, intention, project_id, biz_rating, energy_rating, started_at, completed_at, value_tags}]
  const ids = [];
  for (const e of entries) {
    const id = db.createRetroPomodoro(
      e.day_id, e.block_index || 0, e.pom_index || 0,
      e.intention, e.value_tags || [], e.project_id,
      e.biz_rating, e.energy_rating, e.started_at, e.completed_at
    );
    ids.push(id);
  }
  res.json({ ids });
});

// Save a movement
app.post("/api/movements", (req, res) => {
  const { day_id, block_index, type, exercise, duration_seconds } = req.body;
  const id = db.createMovement(day_id, block_index, type, exercise, duration_seconds);
  res.json({ id });
});

// Update day points/XP
app.patch("/api/days/:id/points", (req, res) => {
  const { total_points, day_xp, effective_xp, streak_day, rank_level } = req.body;
  db.updateDayPoints(req.params.id, total_points, day_xp || 0, effective_xp || 0, streak_day, rank_level);
  res.json({ ok: true });
});

// Gamification upsert
app.put("/api/gamification", (req, res) => {
  const { date, cumulative_points, cumulative_xp, current_rank, streak_length, level_change } = req.body;
  db.upsertGamification(date, cumulative_points || 0, cumulative_xp || 0, current_rank, streak_length, level_change);
  res.json({ ok: true });
});

// Get gamification history (last N days)
app.get("/api/gamification/history", (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const history = db.getGamificationHistory(days);
  res.json(history);
});

// Get week summary (for charts)
app.get("/api/week", (req, res) => {
  const summary = db.getWeekSummary();
  res.json(summary);
});

// Calendar month view
app.get("/api/calendar", (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7); // "2026-03"
  const startDate = `${month}-01`;
  const y = parseInt(month.slice(0, 4));
  const m = parseInt(month.slice(5, 7));
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
  const data = db.getCalendar(startDate, endDate);
  res.json(data);
});

// Get recent days for streak calculation
app.get("/api/days/recent", (req, res) => {
  const days = parseInt(req.query.count) || 7;
  const recent = db.getRecentDays(days);
  res.json(recent);
});

// --- Serve frontend in production ---
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "..", "dist")));
  app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Health System running on http://localhost:${PORT}`);
});
