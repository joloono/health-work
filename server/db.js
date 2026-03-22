const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "health.db");

// Ensure data directory exists
const fs = require("fs");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// WAL mode for crash resistance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// --- Schema ---

db.exec(`
  CREATE TABLE IF NOT EXISTS days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    total_points INTEGER DEFAULT 0,
    streak_day INTEGER DEFAULT 0,
    rank_level INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS pomodoros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL REFERENCES days(id),
    block_index INTEGER NOT NULL CHECK(block_index BETWEEN 0 AND 3),
    pom_index INTEGER NOT NULL CHECK(pom_index BETWEEN 0 AND 3),
    intention TEXT NOT NULL,
    value_tags TEXT DEFAULT '',
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL REFERENCES days(id),
    block_index INTEGER NOT NULL CHECK(block_index BETWEEN 0 AND 3),
    type TEXT NOT NULL CHECK(type IN ('mini', 'block')),
    exercise TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 60,
    completed_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gamification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    cumulative_points INTEGER DEFAULT 0,
    current_rank INTEGER DEFAULT 1,
    streak_length INTEGER DEFAULT 0,
    level_change TEXT DEFAULT 'none' CHECK(level_change IN ('up', 'down', 'none'))
  );
`);

// --- Migrations ---

// Migrate business_value → value_tags if old schema exists
try {
  const cols = db.pragma("table_info(pomodoros)").map((c) => c.name);
  if (cols.includes("business_value") && !cols.includes("value_tags")) {
    db.exec("ALTER TABLE pomodoros ADD COLUMN value_tags TEXT DEFAULT ''");
    db.exec("UPDATE pomodoros SET value_tags = CASE WHEN business_value = 1 THEN 'umsatz' ELSE '' END");
  }
} catch {}

// --- Day operations ---

const stmtGetDay = db.prepare("SELECT * FROM days WHERE date = ?");
const stmtCreateDay = db.prepare("INSERT OR IGNORE INTO days (date) VALUES (?)");
const stmtUpdateDayPoints = db.prepare(
  "UPDATE days SET total_points = ?, streak_day = ?, rank_level = ? WHERE id = ?"
);

function getDay(date) {
  return stmtGetDay.get(date);
}

function createDay(date) {
  return stmtCreateDay.run(date);
}

function updateDayPoints(id, totalPoints, streakDay, rankLevel) {
  return stmtUpdateDayPoints.run(totalPoints, streakDay, rankLevel, id);
}

// --- Pomodoro operations ---

const stmtCreatePom = db.prepare(
  "INSERT INTO pomodoros (day_id, block_index, pom_index, intention, value_tags) VALUES (?, ?, ?, ?, ?)"
);
const stmtCompletePom = db.prepare(
  "UPDATE pomodoros SET completed_at = datetime('now') WHERE id = ?"
);
const stmtGetPomsByDay = db.prepare(
  "SELECT * FROM pomodoros WHERE day_id = ? ORDER BY block_index, pom_index"
);

function createPomodoro(dayId, blockIndex, pomIndex, intention, valueTags) {
  const tags = Array.isArray(valueTags) ? valueTags.join(",") : (valueTags || "");
  const result = stmtCreatePom.run(dayId, blockIndex, pomIndex, intention, tags);
  return result.lastInsertRowid;
}

function completePomodoro(id) {
  return stmtCompletePom.run(id);
}

function getPomodorosByDay(dayId) {
  return stmtGetPomsByDay.all(dayId);
}

// --- Movement operations ---

const stmtCreateMove = db.prepare(
  "INSERT INTO movements (day_id, block_index, type, exercise, duration_seconds) VALUES (?, ?, ?, ?, ?)"
);
const stmtGetMovesByDay = db.prepare(
  "SELECT * FROM movements WHERE day_id = ? ORDER BY block_index, completed_at"
);

function createMovement(dayId, blockIndex, type, exercise, durationSeconds) {
  const result = stmtCreateMove.run(dayId, blockIndex, type, exercise, durationSeconds || 60);
  return result.lastInsertRowid;
}

function getMovementsByDay(dayId) {
  return stmtGetMovesByDay.all(dayId);
}

// --- Gamification operations ---

const stmtGetGamification = db.prepare("SELECT * FROM gamification WHERE date = ?");
const stmtUpsertGamification = db.prepare(`
  INSERT INTO gamification (date, cumulative_points, current_rank, streak_length, level_change)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(date) DO UPDATE SET
    cumulative_points = excluded.cumulative_points,
    current_rank = excluded.current_rank,
    streak_length = excluded.streak_length,
    level_change = excluded.level_change
`);
const stmtGetGamificationHistory = db.prepare(
  "SELECT * FROM gamification ORDER BY date DESC LIMIT ?"
);

function getGamification(date) {
  return stmtGetGamification.get(date);
}

function upsertGamification(date, cumulativePoints, currentRank, streakLength, levelChange) {
  return stmtUpsertGamification.run(date, cumulativePoints, currentRank, streakLength, levelChange);
}

function getGamificationHistory(days) {
  return stmtGetGamificationHistory.all(days);
}

// --- Week summary ---

const stmtWeekSummary = db.prepare(`
  SELECT
    d.date,
    d.total_points,
    d.streak_day,
    d.rank_level,
    COUNT(DISTINCT p.id) AS pom_count,
    SUM(CASE WHEN p.value_tags != '' AND p.value_tags IS NOT NULL THEN 1 ELSE 0 END) AS tagged_pom_count,
    COUNT(DISTINCT m.id) AS move_count,
    COALESCE(SUM(m.duration_seconds), 0) AS move_seconds
  FROM days d
  LEFT JOIN pomodoros p ON p.day_id = d.id AND p.completed_at IS NOT NULL
  LEFT JOIN movements m ON m.day_id = d.id
  WHERE d.date >= date('now', '-6 days')
  GROUP BY d.id
  ORDER BY d.date
`);

function getWeekSummary() {
  return stmtWeekSummary.all();
}

// --- Recent days ---

const stmtRecentDays = db.prepare(
  "SELECT * FROM days ORDER BY date DESC LIMIT ?"
);

function getRecentDays(count) {
  return stmtRecentDays.all(count);
}

module.exports = {
  getDay,
  createDay,
  updateDayPoints,
  createPomodoro,
  completePomodoro,
  getPomodorosByDay,
  createMovement,
  getMovementsByDay,
  getGamification,
  upsertGamification,
  getGamificationHistory,
  getWeekSummary,
  getRecentDays,
};
