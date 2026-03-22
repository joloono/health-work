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
  res.json({ day, pomodoros, movements, gamification });
});

// Save/complete a pomodoro
app.post("/api/pomodoros", (req, res) => {
  const { day_id, block_index, pom_index, intention, value_tags } = req.body;
  const id = db.createPomodoro(day_id, block_index, pom_index, intention, value_tags);
  res.json({ id });
});

app.patch("/api/pomodoros/:id/complete", (req, res) => {
  db.completePomodoro(req.params.id);
  res.json({ ok: true });
});

// Save a movement
app.post("/api/movements", (req, res) => {
  const { day_id, block_index, type, exercise, duration_seconds } = req.body;
  const id = db.createMovement(day_id, block_index, type, exercise, duration_seconds);
  res.json({ id });
});

// Update day points
app.patch("/api/days/:id/points", (req, res) => {
  const { total_points, streak_day, rank_level } = req.body;
  db.updateDayPoints(req.params.id, total_points, streak_day, rank_level);
  res.json({ ok: true });
});

// Gamification upsert
app.put("/api/gamification", (req, res) => {
  const { date, cumulative_points, current_rank, streak_length, level_change } = req.body;
  db.upsertGamification(date, cumulative_points, current_rank, streak_length, level_change);
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
