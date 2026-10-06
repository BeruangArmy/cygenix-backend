// CyGenix backend unit tests (Node built-in test runner, no extra packages).
// Run from cygenix-backend/:   node --test test/unit.test.js
//
// firebaseAdmin.js needs real credentials, so it is replaced with a small
// in-memory fake before any module that imports it is loaded. Nothing here
// touches the live Firebase project.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ---------- in-memory Firestore fake ----------
function makeDb(seed = {}) {
  const store = new Map(Object.entries(seed)); // key: 'col/doc[/col/doc]' -> data
  const snap = (key) => ({ id: key.split('/').pop(), exists: store.has(key), data: () => store.get(key) });
  const col = (prefix) => ({
    doc: (id) => docRef(`${prefix}/${id}`),
    add: async (data) => { const id = `auto${store.size}`; store.set(`${prefix}/${id}`, data); return { id }; },
    get: async () => {
      const depth = prefix.split('/').length + 1;
      const docs = [...store.keys()]
        .filter((k) => k.startsWith(prefix + '/') && k.split('/').length === depth)
        .map(snap);
      return { docs, size: docs.length };
    },
  });
  const docRef = (key) => ({
    _key: key,
    get: async () => snap(key),
    set: async (data, opts) => store.set(key, opts && opts.merge ? { ...(store.get(key) || {}), ...data } : data),
    collection: (name) => col(`${key}/${name}`),
  });
  return {
    store,
    collection: (name) => col(name),
    runTransaction: async (fn) => fn({
      get: (ref) => ref.get(),
      set: (ref, data, opts) => ref.set(data, opts),
    }),
  };
}

const fakeAdmin = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TS' } } };
const fake = { db: makeDb(), admin: fakeAdmin, auth: { verifyIdToken: async () => { throw new Error('bad token'); } } };
const adminPath = require.resolve(path.join(__dirname, '../src/firebaseAdmin'));
require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: fake };

const { xpToNextLevel, levelForXp } = require('../src/xpCurve');
const { levelsCleared, highestLevelCleared } = require('../src/quizLevels');
const { RANK_TIERS, tierIndexForXp, tierIndexByName } = require('../src/rankTiers');
const { verifyToken, adminOnly } = require('../src/middleware/auth');
const badges = require('../src/badges');

const fakeRes = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const isoDay = (daysAgo) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - daysAgo); return d.toISOString().slice(0, 10); };

// ---------- UT-01 XP curve ----------
test('UT-01 xpCurve: XP needed per level grows by 50', () => {
  assert.equal(xpToNextLevel(1), 200);
  assert.equal(xpToNextLevel(2), 250);
  assert.equal(xpToNextLevel(8), 550);
});
test('UT-01 xpCurve: total XP maps to the right level', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(199), 1);
  assert.equal(levelForXp(200), 2);
  assert.equal(levelForXp(2958), 8);  // value seen on the phone before the Hard quiz
  assert.equal(levelForXp(3058), 9);  // value seen on the phone after +100 XP
});

// ---------- UT-02 quiz levels ----------
test('UT-02 quizLevels: levels cleared from quiz state', () => {
  assert.equal(levelsCleared(null), 0);
  assert.equal(levelsCleared({ currentLevel: 'easy', phase: 'in_progress' }), 0);
  assert.equal(levelsCleared({ currentLevel: 'medium', phase: 'in_progress' }), 1);
  assert.equal(levelsCleared({ currentLevel: 'hard', phase: 'completed' }), 3);
  // optional retry rewinds to easy but must not un-secure the module
  assert.equal(levelsCleared({ currentLevel: 'easy', phase: 'in_progress', completedOnce: true }), 3);
  assert.equal(highestLevelCleared({ currentLevel: 'hard', phase: 'in_progress' }), 'medium');
  assert.equal(highestLevelCleared(null), null);
});

// ---------- UT-03 rank tiers ----------
test('UT-03 rankTiers: XP maps to crest tier', () => {
  const name = (xp) => RANK_TIERS[tierIndexForXp(xp)].name;
  assert.equal(name(0), 'Iron');
  assert.equal(name(799), 'Bronze');
  assert.equal(name(800), 'Silver');
  assert.equal(name(2958), 'Diamond');
  assert.equal(name(4200), 'Obsidian');
  assert.equal(tierIndexByName(' ruby '), 4);
  assert.equal(tierIndexByName('nope'), -1);
});

// ---------- UT-04 auth middleware ----------
test('UT-04 auth: request without a token is rejected (401)', async () => {
  const res = fakeRes(); let nextCalled = false;
  await verifyToken({ headers: {} }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401); assert.equal(nextCalled, false);
});
test('UT-04 auth: invalid token is rejected (401)', async () => {
  const res = fakeRes(); let nextCalled = false;
  await verifyToken({ headers: { authorization: 'Bearer forged' } }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401); assert.equal(nextCalled, false);
});
test('UT-04 auth: valid token but no user profile is rejected (403)', async () => {
  fake.auth.verifyIdToken = async () => ({ uid: 'ghost', email: 'g@vasbcorp.com' });
  const res = fakeRes();
  await verifyToken({ headers: { authorization: 'Bearer ok' } }, res, () => {});
  assert.equal(res.statusCode, 403);
});
test('UT-04 auth: adminOnly blocks employees and allows admins', () => {
  const r1 = fakeRes(); let n1 = false;
  adminOnly({ userDoc: { role: 'employee' } }, r1, () => { n1 = true; });
  assert.equal(r1.statusCode, 403); assert.equal(n1, false);
  const r2 = fakeRes(); let n2 = false;
  adminOnly({ userDoc: { role: 'admin' } }, r2, () => { n2 = true; });
  assert.equal(n2, true);
});

// ---------- UT-05 streaks and badges ----------
test('UT-05 bumpStreak: consecutive day, same day, insurance and reset', async () => {
  fake.db = makeDb({
    'users/a': { streakDays: 3, lastActivityDate: isoDay(1) },
    'users/b': { streakDays: 3, lastActivityDate: isoDay(0) },
    'users/c': { streakDays: 3, lastActivityDate: isoDay(2), streakInsurance: 1 },
    'users/d': { streakDays: 5, highestStreak: 5, lastActivityDate: isoDay(3) },
  });
  require.cache[adminPath].exports.db = fake.db;
  // badges.js captured db at load time, so re-load it against the new fake
  delete require.cache[require.resolve('../src/badges')];
  delete require.cache[require.resolve('../src/notifications')];
  const { bumpStreak } = require('../src/badges');
  assert.equal(await bumpStreak('a'), 4);
  assert.equal(await bumpStreak('b'), 3);
  assert.equal(await bumpStreak('c'), 4);
  assert.equal(fake.db.store.get('users/c').streakInsurance, 0);
  assert.equal(await bumpStreak('d'), 1);
  assert.equal(fake.db.store.get('users/d').highestStreak, 5);
});
test('UT-05 checkAndAwardBadges: awards earned badges once, skips drafts', async () => {
  fake.db = makeDb({
    'badges/perfect': { badgeName: 'Perfect Run', criteriaType: 'quiz_perfect' },
    'badges/diamond': { badgeName: 'Diamond Crest', criteriaType: 'rank_tier', criteriaValue: 'Diamond' },
    'badges/draft': { badgeName: 'Draft Badge', criteriaType: 'quiz_perfect', status: 'draft' },
    'badges/lvl20': { badgeName: 'Level 20', criteriaType: 'level_reached', criteriaValue: '20' },
    'users/u1': { xpTotal: 2958, level: 8 },
  });
  require.cache[adminPath].exports.db = fake.db;
  delete require.cache[require.resolve('../src/badges')];
  delete require.cache[require.resolve('../src/notifications')];
  const { checkAndAwardBadges } = require('../src/badges');
  const first = await checkAndAwardBadges('u1', { perfectScoreJustAchieved: true });
  assert.deepEqual(first.map((b) => b.badgeName).sort(), ['Diamond Crest', 'Perfect Run']);
  const second = await checkAndAwardBadges('u1', { perfectScoreJustAchieved: true });
  assert.equal(second.length, 0); // no duplicates
  const notes = [...fake.db.store.keys()].filter((k) => k.startsWith('users/u1/notifications/'));
  assert.equal(notes.length, 2); // one "New badge earned!" notification per badge
});

// ---------- UT-06 one level formula, everywhere ----------
// Regression guard for the bug where completing a lesson LOWERED your level.
//
// lessons.js still computed `1 + Math.floor(xp / 500)` — the flat rule the
// curve replaced — and wrote it to the same `level` field quizState,
// challenges and loop write with levelForXp(). So a lesson overwrote a
// correct level with a lower one: 3058 XP read as level 9 after a quiz and
// level 7 after a lesson, bouncing back on the next quiz.
test('UT-06 levels: the curve and the old flat rule really do disagree', () => {
  const flat = (xp) => 1 + Math.floor(xp / 500);
  // The three accounts that had progress when this was found.
  assert.equal(levelForXp(3058), 9);  assert.equal(flat(3058), 7);
  assert.equal(levelForXp(791), 4);   assert.equal(flat(791), 2);
  assert.equal(levelForXp(475), 3);   assert.equal(flat(475), 1);
});

test('UT-06 levels: no route computes a level without the curve', () => {
  const fs = require('node:fs');
  const dir = path.join(__dirname, '..', 'src', 'routes');
  const offenders = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    // Strip comments so the explanation above a fix is not read as the bug.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/Math\.floor\s*\(\s*[A-Za-z_$][\w$]*\s*\/\s*500\s*\)/.test(code)) offenders.push(f);
  }
  assert.deepEqual(offenders, [],
    `these still use the flat 500-XP rule instead of levelForXp(): ${offenders.join(', ')}`);
});
