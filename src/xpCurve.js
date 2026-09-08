// XP required to go from `level` to `level + 1`. Grows by 50 XP per level
// (200, 250, 300, ...) so leveling up gets steadily harder — replaces the
// old flat "500 XP per level" rule.
function xpToNextLevel(level) {
  return 200 + (level - 1) * 50;
}

// Total XP -> current level, by walking the (uncapped) curve.
function levelForXp(xpTotal) {
  let level = 1;
  let remaining = xpTotal;
  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level);
    level += 1;
  }
  return level;
}

module.exports = { xpToNextLevel, levelForXp };
