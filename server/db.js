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
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#c44d2b',
    default_value_category TEXT DEFAULT '',
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

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    icon TEXT DEFAULT '',
    color TEXT DEFAULT '#888',
    description TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
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

// Migrate projects table
try {
  const projCols = db.pragma("table_info(projects)").map((c) => c.name);
  if (!projCols.includes("description")) {
    db.exec("ALTER TABLE projects ADD COLUMN description TEXT DEFAULT ''");
  }
  if (!projCols.includes("default_value_category")) {
    db.exec("ALTER TABLE projects ADD COLUMN default_value_category TEXT DEFAULT ''");
  }
} catch {}

// Migrate pomodoros: add flexible entry columns
try {
  const pomCols = db.pragma("table_info(pomodoros)").map((c) => c.name);
  if (!pomCols.includes("entry_type")) {
    db.exec("ALTER TABLE pomodoros ADD COLUMN entry_type TEXT DEFAULT 'pomodoro'");
  }
  if (!pomCols.includes("duration_minutes")) {
    db.exec("ALTER TABLE pomodoros ADD COLUMN duration_minutes INTEGER DEFAULT 25");
  }
  if (!pomCols.includes("notes")) {
    db.exec("ALTER TABLE pomodoros ADD COLUMN notes TEXT DEFAULT ''");
  }
} catch {}

// Create todos table
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL REFERENCES days(id),
    text TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    carried_from_id INTEGER
  );
`);

// Seed default categories if table is empty
try {
  const catCount = db.prepare("SELECT COUNT(*) as c FROM categories").get().c;
  if (catCount === 0) {
    const insert = db.prepare("INSERT INTO categories (slug, label, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)");
    insert.run("umsatz", "Umsatz", "💰", "#f5c842", 1);
    insert.run("gesundheit", "Gesundheit", "🏥", "#7ec4e8", 2);
    insert.run("investition", "Investition", "🌱", "#b88a70", 3);
    insert.run("oekosystem", "App-Ökosystem", "🔧", "#e8945a", 4);
    insert.run("systeme", "Systeme", "⚙️", "#a09c92", 5);
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
  "INSERT INTO projects (name, description, color, default_value_category, client) VALUES (?, ?, ?, ?, ?)"
);
const stmtUpdateProject = db.prepare(
  "UPDATE projects SET name = ?, description = ?, color = ?, default_value_category = ?, client = ?, active = ? WHERE id = ?"
);
const stmtGetActiveProjects = db.prepare(
  "SELECT * FROM projects WHERE active = 1 ORDER BY name"
);
const stmtGetAllProjects = db.prepare("SELECT * FROM projects ORDER BY name");
const stmtFindProjectByName = db.prepare("SELECT * FROM projects WHERE LOWER(name) = LOWER(?)");

function createProject(name, color, client, description, defaultValueCategory) {
  // Auto-merge: if project with same name exists, return existing + reactivate
  const existing = stmtFindProjectByName.get(name);
  if (existing) {
    if (!existing.active) {
      stmtUpdateProject.run(existing.name, existing.description, existing.color, existing.default_value_category, existing.client, 1, existing.id);
    }
    return existing.id;
  }
  const result = stmtCreateProject.run(name, description || "", color || "#c44d2b", defaultValueCategory || "", client || "");
  return result.lastInsertRowid;
}

function updateProject(id, name, description, color, defaultValueCategory, client, active) {
  return stmtUpdateProject.run(name, description || "", color, defaultValueCategory || "", client || "", active ? 1 : 0, id);
}

function getActiveProjects() {
  return stmtGetActiveProjects.all();
}

function getAllProjects() {
  return stmtGetAllProjects.all();
}

// --- Pomodoro operations ---

const stmtCreatePom = db.prepare(
  "INSERT INTO pomodoros (day_id, block_index, pom_index, intention, value_tags, project_id, entry_type, duration_minutes, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
const stmtCompletePom = db.prepare(
  "UPDATE pomodoros SET completed_at = datetime('now') WHERE id = ?"
);
const stmtRatePom = db.prepare(
  "UPDATE pomodoros SET biz_rating = ?, energy_rating = ? WHERE id = ?"
);
const stmtGetPomsByDay = db.prepare(
  "SELECT p.*, pr.name AS project_name, pr.color AS project_color FROM pomodoros p LEFT JOIN projects pr ON p.project_id = pr.id WHERE p.day_id = ? ORDER BY p.started_at"
);

function createPomodoro(dayId, blockIndex, pomIndex, intention, valueTags, projectId, entryType, durationMinutes, notes) {
  const tags = Array.isArray(valueTags) ? valueTags.join(",") : (valueTags || "");
  const result = stmtCreatePom.run(dayId, blockIndex || 0, pomIndex || 0, intention, tags, projectId || null, entryType || "pomodoro", durationMinutes || 25, notes || "");
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
    COALESCE(ps.pom_count, 0) AS pom_count,
    COALESCE(ps.tagged_pom_count, 0) AS tagged_pom_count,
    COALESCE(ps.biz_rating_sum, 0) AS biz_rating_sum,
    COALESCE(ps.total_minutes, 0) AS total_minutes,
    COALESCE(ms.move_count, 0) AS move_count,
    COALESCE(ms.move_seconds, 0) AS move_seconds
  FROM days d
  LEFT JOIN (
    SELECT day_id,
      COUNT(*) AS pom_count,
      SUM(CASE WHEN value_tags != '' AND value_tags IS NOT NULL THEN 1 ELSE 0 END) AS tagged_pom_count,
      COALESCE(SUM(biz_rating), 0) AS biz_rating_sum,
      COALESCE(SUM(duration_minutes), 0) AS total_minutes
    FROM pomodoros WHERE completed_at IS NOT NULL
    GROUP BY day_id
  ) ps ON ps.day_id = d.id
  LEFT JOIN (
    SELECT day_id,
      COUNT(*) AS move_count,
      COALESCE(SUM(duration_seconds), 0) AS move_seconds
    FROM movements
    GROUP BY day_id
  ) ms ON ms.day_id = d.id
  WHERE d.date >= date('now', '-6 days')
  ORDER BY d.date
`);

function getWeekSummary() {
  return stmtWeekSummary.all();
}

// --- Calendar (month view) ---

const stmtCalendar = db.prepare(`
  SELECT
    d.date,
    d.total_points,
    d.day_xp,
    d.effective_xp,
    d.streak_day,
    COALESCE(ps.pom_count, 0) AS pom_count,
    COALESCE(ps.biz_rating_sum, 0) AS biz_rating_sum,
    COALESCE(ps.energy_sum, 0) AS energy_sum,
    COALESCE(ms.move_count, 0) AS move_count
  FROM days d
  LEFT JOIN (
    SELECT day_id,
      COUNT(*) AS pom_count,
      COALESCE(SUM(biz_rating), 0) AS biz_rating_sum,
      COALESCE(SUM(energy_rating), 0) AS energy_sum
    FROM pomodoros WHERE completed_at IS NOT NULL
    GROUP BY day_id
  ) ps ON ps.day_id = d.id
  LEFT JOIN (
    SELECT day_id, COUNT(*) AS move_count
    FROM movements
    GROUP BY day_id
  ) ms ON ms.day_id = d.id
  WHERE d.date BETWEEN ? AND ?
  ORDER BY d.date
`);

function getCalendar(startDate, endDate) {
  return stmtCalendar.all(startDate, endDate);
}

// --- Category operations ---

const stmtGetCategories = db.prepare("SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, label");
const stmtGetAllCategories = db.prepare("SELECT * FROM categories ORDER BY sort_order, label");
const stmtCreateCategory = db.prepare("INSERT INTO categories (slug, label, icon, color, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
const stmtUpdateCategory = db.prepare("UPDATE categories SET slug = ?, label = ?, icon = ?, color = ?, description = ?, active = ?, sort_order = ? WHERE id = ?");

function getCategories() { return stmtGetCategories.all(); }
function getAllCategories() { return stmtGetAllCategories.all(); }

function createCategory(slug, label, icon, color, description, sortOrder) {
  const result = stmtCreateCategory.run(slug, label, icon || "", color || "#888", description || "", sortOrder || 0);
  return result.lastInsertRowid;
}

function updateCategory(id, slug, label, icon, color, description, active, sortOrder) {
  return stmtUpdateCategory.run(slug, label, icon || "", color || "#888", description || "", active ? 1 : 0, sortOrder || 0, id);
}

// --- Todo operations ---

const stmtCreateTodo = db.prepare(
  "INSERT INTO todos (day_id, text, sort_order, carried_from_id) VALUES (?, ?, ?, ?)"
);
const stmtToggleTodo = db.prepare(
  "UPDATE todos SET done = ?, completed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END WHERE id = ?"
);
const stmtDeleteTodo = db.prepare("DELETE FROM todos WHERE id = ?");
const stmtGetTodosByDay = db.prepare(
  "SELECT * FROM todos WHERE day_id = ? ORDER BY done, sort_order, created_at"
);
const stmtGetOpenTodosYesterday = db.prepare(`
  SELECT t.* FROM todos t
  JOIN days d ON t.day_id = d.id
  WHERE d.date = date(?, '-1 day') AND t.done = 0
  ORDER BY t.sort_order, t.created_at
`);

function createTodo(dayId, text, sortOrder, carriedFromId) {
  const result = stmtCreateTodo.run(dayId, text, sortOrder || 0, carriedFromId || null);
  return result.lastInsertRowid;
}

function toggleTodo(id, done) {
  return stmtToggleTodo.run(done ? 1 : 0, done ? 1 : 0, id);
}

function deleteTodo(id) {
  return stmtDeleteTodo.run(id);
}

function getTodosByDay(dayId) {
  return stmtGetTodosByDay.all(dayId);
}

function getOpenTodosFromYesterday(today) {
  return stmtGetOpenTodosYesterday.all(today);
}

// --- Streak calculation ---

const stmtStreakDays = db.prepare(`
  SELECT d.date,
    COUNT(DISTINCT CASE WHEN p.completed_at IS NOT NULL THEN p.id END) AS pom_count,
    COUNT(DISTINCT m.id) AS move_count
  FROM days d
  LEFT JOIN pomodoros p ON p.day_id = d.id
  LEFT JOIN movements m ON m.day_id = d.id
  WHERE d.date <= ?
  GROUP BY d.id
  ORDER BY d.date DESC
  LIMIT 60
`);

function calcStreakLength(today) {
  const rows = stmtStreakDays.all(today);
  let streak = 0;
  let expectedDate = new Date(today + "T00:00:00Z");
  for (const row of rows) {
    const rowDate = row.date;
    const expected = expectedDate.toISOString().slice(0, 10);
    if (rowDate !== expected) break; // gap in days
    if (row.pom_count >= 1 && row.move_count >= 1) {
      streak++;
    } else {
      break; // day didn't qualify
    }
    expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
  }
  return streak;
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
  createTodo,
  toggleTodo,
  deleteTodo,
  getTodosByDay,
  getOpenTodosFromYesterday,
  getGamification,
  upsertGamification,
  getGamificationHistory,
  getWeekSummary,
  getCalendar,
  getRecentDays,
  calcStreakLength,
  getCategories,
  getAllCategories,
  createCategory,
  updateCategory,
};
