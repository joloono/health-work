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

// Points: 1 per pom, 2 per movement, + sum of biz_ratings
// Max: 16 + 20*2 + 64 = 120
export function calcDayPoints(pomCount, moveCount, bizRatingSum) {
  return pomCount + moveCount * 2 + bizRatingSum;
}

// Streak: day counts if at least 1 pom + 1 movement
export function dayCountsForStreak(pomCount, moveCount) {
  return pomCount >= 1 && moveCount >= 1;
}

// Level-up threshold: need 3 consecutive streak days with avg >= threshold
// Progressive: base 40 pts/day, +3 per rank above 5 (scaled for max 120)
export function getLevelUpThreshold(currentRank) {
  if (currentRank <= 5) return 40;
  return 40 + (currentRank - 5) * 3;
}

// Calculate new rank based on gamification history
// history: array of recent day records [{date, points, hadStreak}], newest first
export function calculateRankChange(currentRank, streakLength, recentDayPoints) {
  // Level loss: 2+ days inactive -> drop 1 rank (minimum 1)
  // This is handled by checking if today has no activity and yesterday had none
  // The caller passes inactiveDays count

  // Level up: streak >= 3 and avg of last 3 days >= threshold
  if (streakLength >= 3 && recentDayPoints.length >= 3) {
    const last3Avg = recentDayPoints.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const threshold = getLevelUpThreshold(currentRank);
    if (last3Avg >= threshold && currentRank < 30) {
      return { newRank: currentRank + 1, change: "up" };
    }
  }

  return { newRank: currentRank, change: "none" };
}

export function calculateLevelLoss(currentRank, inactiveDays) {
  if (inactiveDays >= 2 && currentRank > 1) {
    return { newRank: currentRank - 1, change: "down" };
  }
  return { newRank: currentRank, change: "none" };
}
