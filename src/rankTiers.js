// The crest ladder's XP thresholds.
//
// Mirrors kRankTiers in flutter_app/lib/widgets/crests.dart. The client draws
// the crests from this same ladder; this copy exists so badge criteria can be
// evaluated server-side, where every XP award already happens.
const RANK_TIERS = [
  { name: 'Iron', minXp: 0 },
  { name: 'Bronze', minXp: 300 },
  { name: 'Silver', minXp: 800 },
  { name: 'Gold', minXp: 1100 },
  { name: 'Ruby', minXp: 1800 },
  { name: 'Diamond', minXp: 2800 },
  { name: 'Obsidian', minXp: 4200 },
];

/** The tier index a given XP total sits in. */
function tierIndexForXp(xp) {
  let idx = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if ((xp || 0) >= RANK_TIERS[i].minXp) idx = i;
  }
  return idx;
}

function tierIndexByName(name) {
  return RANK_TIERS.findIndex(
    (t) => t.name.toLowerCase() === `${name || ''}`.trim().toLowerCase(),
  );
}

module.exports = { RANK_TIERS, tierIndexForXp, tierIndexByName };
