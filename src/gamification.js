// ===== RANKS (30 Greek-antiquity ranks) =====

export const RANKS = [
  { level: 1, name: "Néos", title: "Neuling" },
  { level: 2, name: "Néos Dókimos", title: "Bewährter Neuling" },
  { level: 3, name: "Mathitís", title: "Schüler" },
  { level: 4, name: "Mathitís Prótos", title: "Erster Schüler" },
  { level: 5, name: "Ephébos", title: "Kadett" },
  { level: 6, name: "Ephébos Dókimos", title: "Bewährter Kadett" },
  { level: 7, name: "Hoplítis", title: "Hoplit" },
  { level: 8, name: "Hoplítis Prótos", title: "Erster Hoplit" },
  { level: 9, name: "Pentekóntarchos", title: "Führer von 50" },
  { level: 10, name: "Hekatóntarchos", title: "Zenturio" },
  { level: 11, name: "Hekatóntarchos Prótos", title: "Erster Zenturio" },
  { level: 12, name: "Lochagós", title: "Kompanie-Führer" },
  { level: 13, name: "Lochagós Mégas", title: "Grosser Kompanie-Führer" },
  { level: 14, name: "Taxíarchos", title: "Bataillonsführer" },
  { level: 15, name: "Taxíarchos Prótos", title: "Erster Bataillonsführer" },
  { level: 16, name: "Chiliarchos", title: "Führer von Tausend" },
  { level: 17, name: "Chiliarchos Mégas", title: "Grosser Chiliarch" },
  { level: 18, name: "Polemarchos", title: "Kriegsherr" },
  { level: 19, name: "Polemarchos Prótos", title: "Erster Kriegsherr" },
  { level: 20, name: "Strategos", title: "General" },
  { level: 21, name: "Strategos Dókimos", title: "Bewährter General" },
  { level: 22, name: "Strategos Mégas", title: "Grosser General" },
  { level: 23, name: "Strategos Autokrátor", title: "Oberbefehlshaber" },
  { level: 24, name: "Archon", title: "Herrscher" },
  { level: 25, name: "Archon Prótos", title: "Erster Herrscher" },
  { level: 26, name: "Archon Epónymos", title: "Namensgebender Archon" },
  { level: 27, name: "Archon Polemarchos", title: "Kriegs-Archon" },
  { level: 28, name: "Archon Mégas", title: "Gross-Archon" },
  { level: 29, name: "Archon Basileús", title: "König der Archonten" },
  { level: 30, name: "Olympionikes", title: "Olympiasieger" },
];

export function getRank(level) {
  const clamped = Math.max(1, Math.min(30, level));
  return RANKS[clamped - 1];
}

// ===== PRINZIP 1: XP for Actions =====

export const XP_VALUES = {
  pomodoro: 10,
  movement: 20,
  bizRatingBonus: 5,   // per biz_rating point (1-4)
  energyBonus: 3,      // per positive energy point
  retroPomodoro: 8,
};

export function calcDayXP(pomCount, moveCount, bizRatingSum, energySum, retroCount = 0) {
  const liveXP = (pomCount - retroCount) * XP_VALUES.pomodoro
               + retroCount * XP_VALUES.retroPomodoro;
  const moveXP = moveCount * XP_VALUES.movement;
  const bizXP = bizRatingSum * XP_VALUES.bizRatingBonus;
  const energyXP = Math.max(0, energySum) * XP_VALUES.energyBonus;
  return liveXP + moveXP + bizXP + energyXP;
}

// ===== PRINZIP 2: Streak Multiplier =====

export function getStreakMultiplier(streakDays) {
  if (streakDays >= 30) return 1.5;
  if (streakDays >= 14) return 1.35;
  if (streakDays >= 7) return 1.25;
  if (streakDays >= 3) return 1.1;
  return 1.0;
}

export function calcEffectiveXP(dayXP, streakDays) {
  return Math.round(dayXP * getStreakMultiplier(streakDays));
}

// Streak: day counts if at least 1 pom + 1 movement
export function dayCountsForStreak(pomCount, moveCount) {
  return pomCount >= 1 && moveCount >= 1;
}

// ===== PRINZIP 3: Soft Streak Decay =====

export function decayStreak(currentStreak, inactiveDays) {
  if (inactiveDays <= 1) return currentStreak; // Gnadetag
  let s = currentStreak;
  for (let d = 2; d <= inactiveDays; d++) {
    s = Math.floor(s / 2);
  }
  return Math.max(0, s);
}

// ===== PRINZIP 4: Progressive XP Leveling =====

export function xpForLevel(level) {
  return 500 * level * (level + 1) / 2;
}

export function getLevelFromXP(totalXP) {
  let level = 1;
  while (level < 30 && xpForLevel(level) <= totalXP) level++;
  return level;
}

export function getLevelProgress(totalXP) {
  const level = getLevelFromXP(totalXP);
  if (level >= 30) return { level: 30, current: totalXP, needed: xpForLevel(29), progress: 1 };
  const prevThreshold = level > 1 ? xpForLevel(level - 1) : 0;
  const nextThreshold = xpForLevel(level);
  const progress = nextThreshold > prevThreshold
    ? (totalXP - prevThreshold) / (nextThreshold - prevThreshold)
    : 0;
  return { level, current: totalXP, needed: nextThreshold, prevNeeded: prevThreshold, progress: Math.min(1, Math.max(0, progress)) };
}

// ===== PRINZIP 5: XP Decay =====

export function calcXPDecay(cumulativeXP, inactiveDays) {
  if (inactiveDays <= 1) return 0;
  const rate = Math.min(0.10, 0.02 * (inactiveDays - 1));
  return Math.round(cumulativeXP * rate);
}
