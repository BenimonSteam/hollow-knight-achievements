export function levelFromXp(totalXp) {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  return Math.max(1, Math.floor(Math.sqrt(xp / 120)) + 1);
}

export function xpForLevel(level) {
  const safeLevel = Math.max(1, Math.floor(level || 1));
  return 120 * Math.pow(safeLevel - 1, 2);
}

export function battleStatsForLevel(level) {
  const safeLevel = Math.max(1, Math.floor(level || 1));
  return {
    maxHp: Math.round(90 + safeLevel * 14),
    attack: Math.round(12 + safeLevel * 2),
    defense: Math.round(8 + safeLevel * 1.6),
    healBase: Math.round(10 + safeLevel * 1.4),
    guardBase: Math.round(7 + safeLevel * 1.5),
  };
}

export function xpFromAchievements(achievements) {
  const list = Array.isArray(achievements) ? achievements : [];
  let xp = 0;
  for (const a of list) {
    if (!a?.achieved) continue;
    const globalPercent = Number(a.globalPercent);
    const rarityBonus = Number.isFinite(globalPercent)
      ? Math.max(0, Math.round((15 - Math.min(15, globalPercent)) * 2))
      : 4;
    xp += 12 + rarityBonus;
  }
  return Math.max(0, xp);
}
