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
    day_xp INTEGER DEFAULT 0,
    effective_xp INTEGER DEFAULT 0,
    streak_day INTEGER DEFAULT 0,
    rank_level INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#c44d2b',
    client TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pomodoros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL REFERENCES days(id),
    block_index INTEGER NOT NULL CHECK(block_index BETWEEN 0 AND 3),
    pom_index INTEGER NOT NULL CHECK(pom_index BETWEEN 0 AND 3),
    intention TEXT NOT NULL,
    value_tags TEXT DEFAULT '',
    project_id INTEGER REFERENCES projects(id),
    biz_rating INTEGER,
    energy_rating INTEGER,
    retroactive INTEGER DEFAULT 0,
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
    cumulative_xp INTEGER DEFAULT 0,
    current_rank INTEGER DEFAULT 1,
    streak_length INTEGER DEFAULT 0,
    level_change TEXT DEFAULT 'none' CHECK(level_change IN ('up', 'down', 'none'))
  );
`);

// --- Migrations (for existing DBs) ---

try {
  const cols = db.pragma("table_info(pomodoros)").map((c) => c.name);
  if (cols.includes("business_value") && !cols.includes("value_tags")) {
    db.exec("ALTER TABLE pomodoros ADD COLUMN value_tags TEXT DEFAULT ''");
    db.exec("UPDATE pomodoros SET value_tags = CASE WHEN business_value = 1 THEN 'umsatz' ELSE '' END");
  }
  if (!cols.includes("project_id")) {
    db.exec("ALTER TABLE pomodoros ADD COLUMN project_id INTEGER REFERENCES projects(id)");
  }
  if (!cols.includes("biz_rating")) {
    db.exec("ALTER TABLE pomodoros ADD COLUMN biz_rating INTEGER");
  }
  if (!cols.includes("energy_rating")) {
    db.exec("ALTER TABLE pomodoros ADD COLUMN energy_rating INTEGER");
  }
  if (!cols.includes("retroactive")) {
    db.exec("ALTER TABLE pomodoros ADD COLUMN retroactive INTEGER DEFAULT 0");
  }
} catch {}

// Migrate days table
try {
  const dayCols = db.pragma("table_info(days)").map((c) => c.name);
  if (!dayCols.includes("day_xp")) {
    db.exec("ALTER TABLE days ADD COLUMN day_xp INTEGER DEFAULT 0");
  }
  if (!dayCols.includes("effective_xp")) {
    db.exec("ALTER TABLE days ADD COLUMN effective_xp INTEGER DEFAULT 0");
  }
} catch {}

// Migrate gamification table
try {
  const gamCols = db.pragma("table_info(gamification)").map((c) => c.name);
  if (!gamCols.includes("cumulative_xp")) {
    db.exec("ALTER TABLE gamification ADD COLUMN cumulative_xp INTEGER DEFAULT 0");
    db.exec("UPDATE gamification SET cumulative_xp = cumulative_points * 10");
  }
} catch {}

// --- Day operations ---

const stmtGetDay = db.prepare("SELECT * FROM days WHERE date = ?");
const stmtCreateDay = db.prepare("INSERT OR IGNORE INTO days (date) VALUES (?)");
const stmtUpdateDayPoints = db.prepare(
  "UPDATE days SET total_points = ?, day_xp = ?, effective_xp = ?, streak_day = ?, rank_level = ? WHERE id = ?"
);

function getDay(date) {
  return stmtGetDay.get(date);
}

function createDay(date) {
  return stmtCreateDay.run(date);
}

function updateDayPoints(id, totalPoints, dayXP, effectiveXP, streakDay, rankLevel) {
  return stmtUpdateDayPoints.run(totalPoints, dayXP, effectiveXP, streakDay, rankLevel, id);
}

// --- Project operations ---

const stmtCreateProject = db.prepare(
  "INSERT INTO projects (name, color, client) VALUES (?, ?, ?)"
);
const stmtUpdateProject = db.prepare(
  "UPDATE projects SET name = ?, color = ?, client = ?, active = ? WHERE id = ?"
);
const stmtGetActiveProjects = db.prepare(
  "SELECT * FROM projects WHERE active = 1 ORDER BY name"
);
const stmtGetAllProjects = db.prepare("SELECT * FROM projects ORDER BY name");

function createProject(name, color, client) {
  const result = stmtCreateProject.run(name, color || "#c44d2b", client || "");
  return result.lastInsertRowid;
}

function updateProject(id, name, color, client, active) {
  return stmtUpdateProject.run(name, color, client, active ? 1 : 0, id);
}

function getActiveProjects() {
  return stmtGetActiveProjects.all();
}

function getAllProjects() {
  return stmtGetAllProjects.all();
}

// --- Pomodoro operations ---

const stmtCreatePom = db.prepare(
  "INSERT INTO pomodoros (day_id, block_index, pom_index, intention, value_tags, project_id) VALUES (?, ?, ?, ?, ?, ?)"
);
const stmtCompletePom = db.prepare(
  "UPDATE pomodoros SET completed_at = datetime('now') WHERE id = ?"
);
const stmtRatePom = db.prepare(
  "UPDATE pomodoros SET biz_rating = ?, energy_rating = ? WHERE id = ?"
);
const stmtGetPomsByDay = db.prepare(
  "SELECT p.*, pr.name AS project_name, pr.color AS project_color FROM pomodoros p LEFT JOIN projects pr ON p.project_id = pr.id WHERE p.day_id = ? ORDER BY p.block_index, p.pom_index"
);

function createPomodoro(dayId, blockIndex, pomIndex, intention, valueTags, projectId) {
  const tags = Array.isArray(valueTags) ? valueTags.join(",") : (valueTags || "");
  const result = stmtCreatePom.run(dayId, blockIndex, pomIndex, intention, tags, projectId || null);
  return result.lastInsertRowid;
}

function completePomodoro(id) {
  return stmtCompletePom.run(id);
}

function ratePomodoro(id, bizRating, energyRating) {
  return stmtRatePom.run(bizRating, energyRating, id);
}

// Retro pomodoros (gap audit)
const stmtCreateRetroPom = db.prepare(
  "INSERT INTO pomodoros (day_id, block_index, pom_index, intention, value_tags, project_id, biz_rating, energy_rating, retroactive, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
);
const stmtLastCompletedPom = db.prepare(
  "SELECT completed_at FROM pomodoros WHERE day_id = ? AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1"
);

function createRetroPomodoro(dayId, blockIndex, pomIndex, intention, valueTags, projectId, bizRating, energyRating, startedAt, completedAt) {
  const tags = Array.isArray(valueTags) ? valueTags.join(",") : (valueTags || "");
  const result = stmtCreateRetroPom.run(dayId, blockIndex, pomIndex, intention, tags, projectId || null, bizRating, energyRating, startedAt, completedAt);
  return result.lastInsertRowid;
}

function getLastCompletedTime(dayId) {
  const row = stmtLastCompletedPom.get(dayId);
  return row ? row.completed_at : null;
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
  INSERT INTO gamification (date, cumulative_points, cumulative_xp, current_rank, streak_length, level_change)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(date) DO UPDATE SET
    cumulative_points = excluded.cumulative_points,
    cumulative_xp = excluded.cumulative_xp,
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

function upsertGamification(date, cumulativePoints, cumulativeXP, currentRank, streakLength, levelChange) {
  return stmtUpsertGamification.run(date, cumulativePoints, cumulativeXP, currentRank, streakLength, levelChange);
}

function getGamificationHistory(days) {
  return stmtGetGamificationHistory.all(days);
}

// --- Week summary ---

const stmtWeekSummary = db.prepare(`
  SELECT
    d.date,
    d.total_points,
    d.day_xp,
    d.effective_xp,
    d.streak_day,
    d.rank_level,
    COUNT(DISTINCT p.id) AS pom_count,
    SUM(CASE WHEN p.value_tags != '' AND p.value_tags IS NOT NULL THEN 1 ELSE 0 END) AS tagged_pom_count,
    COALESCE(SUM(p.biz_rating), 0) AS biz_rating_sum,
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
  createProject,
  updateProject,
  getActiveProjects,
  getAllProjects,
  createPomodoro,
  completePomodoro,
  ratePomodoro,
  createRetroPomodoro,
  getLastCompletedTime,
  getPomodorosByDay,
  createMovement,
  getMovementsByDay,
  getGamification,
  upsertGamification,
  getGamificationHistory,
  getWeekSummary,
  getRecentDays,
};
