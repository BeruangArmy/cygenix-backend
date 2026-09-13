// Badges for the crest ladder (batch item 5).
//
// criteriaType 'rank_tier' is evaluated in src/badges.js against the XP
// thresholds in src/rankTiers.js. Because a badge stays earned once awarded,
// these record the highest tier a user has ever reached rather than the tier
// they currently hold — which is what "highest rank achieved" means.
//
// Re-runnable: keyed by slug, so running it twice changes nothing.
require('dotenv').config();
const { db } = require('./src/firebaseAdmin');

const BADGES = [
  {
    slug: 'rank-silver',
    badgeName: 'Silver Crest',
    criteria: 'Reach the Silver rank tier',
    criteriaType: 'rank_tier',
    criteriaValue: 'Silver',
  },
  {
    slug: 'rank-gold',
    badgeName: 'Gold Crest',
    criteria: 'Reach the Gold rank tier',
    criteriaType: 'rank_tier',
    criteriaValue: 'Gold',
  },
  {
    slug: 'rank-ruby',
    badgeName: 'Ruby Crest',
    criteria: 'Reach the Ruby rank tier',
    criteriaType: 'rank_tier',
    criteriaValue: 'Ruby',
  },
  {
    slug: 'rank-peak',
    badgeName: 'Peak Rank',
    criteria: 'Reach Obsidian, the highest rank tier',
    criteriaType: 'rank_tier',
    criteriaValue: 'Obsidian',
  },
];

(async () => {
  let wrote = 0, skipped = 0;
  for (const b of BADGES) {
    const { slug, ...rest } = b;
    const ref = db.collection('badges').doc(slug);
    if ((await ref.get()).exists) { skipped++; continue; }
    await ref.set({ ...rest, iconUrl: '' });
    console.log('badge:', rest.badgeName, '->', rest.criteriaValue);
    wrote++;
  }
  console.log(`\ndone — wrote ${wrote}, already present ${skipped}`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
