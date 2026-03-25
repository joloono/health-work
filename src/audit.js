/**
 * Audit calculations — reusable module for Wert-Energie-Zeit analysis.
 * Pure functions, no React. Usable from Dashboard, export, Telegram bot, etc.
 *
 * Entry shape (from GET /api/week/entries):
 *   { id, intention, biz_rating (1-4), energy_rating (-2 to +2),
 *     duration_minutes, entry_type, value_tags, project_id,
 *     project_name, project_color, date, completed_at }
 */

// --- Quadrant classification ---

export const QUADRANTS = {
  LEVERAGE:      { key: "leverage",      label: "Hebel",          desc: "Hoher Wert + gibt Energie" },
  DUTY:          { key: "duty",          label: "Pflicht",        desc: "Hoher Wert + kostet Energie" },
  ENERGY_GIVER:  { key: "energy_giver",  label: "Energie-Geber",  desc: "Niedriger Wert + gibt Energie" },
  ELIMINATE:     { key: "eliminate",      label: "Eliminieren",    desc: "Niedriger Wert + kostet Energie" },
};

/**
 * Classify a single entry into a quadrant.
 * Thresholds: biz >= 2.5 = "high value", energy >= 0.5 = "gives energy"
 */
export function classifyQuadrant(bizRating, energyRating) {
  const highValue = bizRating >= 2.5;
  const givesEnergy = energyRating >= 0.5;
  if (highValue && givesEnergy) return QUADRANTS.LEVERAGE;
  if (highValue && !givesEnergy) return QUADRANTS.DUTY;
  if (!highValue && givesEnergy) return QUADRANTS.ENERGY_GIVER;
  return QUADRANTS.ELIMINATE;
}

// --- Aggregation helpers ---

/**
 * Group entries by a key function. Returns Map<key, entry[]>.
 */
export function groupBy(entries, keyFn) {
  const groups = new Map();
  for (const e of entries) {
    const key = keyFn(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return groups;
}

/**
 * Compute duration-weighted averages for biz_rating and energy_rating.
 * Returns { avgBiz, avgEnergy, totalMinutes, count }.
 */
export function weightedAvg(entries) {
  let sumBiz = 0, sumEnergy = 0, totalMin = 0;
  for (const e of entries) {
    const w = e.duration_minutes || 25;
    sumBiz += e.biz_rating * w;
    sumEnergy += e.energy_rating * w;
    totalMin += w;
  }
  if (totalMin === 0) return { avgBiz: 0, avgEnergy: 0, totalMinutes: 0, count: entries.length };
  return {
    avgBiz: sumBiz / totalMin,
    avgEnergy: sumEnergy / totalMin,
    totalMinutes: totalMin,
    count: entries.length,
  };
}

/**
 * Compute aggregated stats per project (duration-weighted).
 * Returns array of { projectId, projectName, projectColor, avgBiz, avgEnergy, totalMinutes, count, quadrant }.
 */
export function aggregateByProject(entries) {
  const groups = groupBy(entries, (e) => e.project_id || 0);
  const result = [];
  for (const [projectId, items] of groups) {
    const { avgBiz, avgEnergy, totalMinutes, count } = weightedAvg(items);
    result.push({
      projectId,
      projectName: items[0].project_name || "Kein Projekt",
      projectColor: items[0].project_color || null,
      avgBiz,
      avgEnergy,
      totalMinutes,
      count,
      quadrant: classifyQuadrant(avgBiz, avgEnergy),
    });
  }
  return result.sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/**
 * Compute aggregated stats per category/value_tag (duration-weighted).
 * Entries can have multiple tags (comma-separated in value_tags).
 * Returns array of { tag, avgBiz, avgEnergy, totalMinutes, count, quadrant }.
 */
export function aggregateByCategory(entries) {
  const tagMap = new Map();
  for (const e of entries) {
    const tags = (e.value_tags || "").split(",").map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) tags.push("_untagged");
    for (const tag of tags) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag).push(e);
    }
  }
  const result = [];
  for (const [tag, items] of tagMap) {
    const { avgBiz, avgEnergy, totalMinutes, count } = weightedAvg(items);
    result.push({
      tag,
      avgBiz,
      avgEnergy,
      totalMinutes,
      count,
      quadrant: classifyQuadrant(avgBiz, avgEnergy),
    });
  }
  return result.sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/**
 * Overall summary across all entries.
 * Returns { avgBiz, avgEnergy, totalMinutes, count, quadrant,
 *           byProject: [...], byCategory: [...], quadrantBreakdown: {...} }
 */
export function auditSummary(entries) {
  const overall = weightedAvg(entries);
  const byProject = aggregateByProject(entries);
  const byCategory = aggregateByCategory(entries);

  // Quadrant breakdown: how many minutes in each quadrant
  const quadrantBreakdown = {};
  for (const q of Object.values(QUADRANTS)) {
    quadrantBreakdown[q.key] = { minutes: 0, count: 0 };
  }
  for (const e of entries) {
    const q = classifyQuadrant(e.biz_rating, e.energy_rating);
    quadrantBreakdown[q.key].minutes += e.duration_minutes || 25;
    quadrantBreakdown[q.key].count += 1;
  }

  return {
    ...overall,
    quadrant: classifyQuadrant(overall.avgBiz, overall.avgEnergy),
    byProject,
    byCategory,
    quadrantBreakdown,
  };
}
