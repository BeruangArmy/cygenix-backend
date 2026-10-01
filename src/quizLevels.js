const QUIZ_LEVELS = ['easy', 'medium', 'hard'];

// How many of a module's 3 quiz levels (Easy/Medium/Hard) the user has
// actually cleared, from users/{uid}/moduleQuizState/{moduleId}.currentLevel
// only advances past a level once it's cleared (see routes/quizState.js),
// so its index in QUIZ_LEVELS *is* the cleared count — and a 'completed'
// phase means all 3 are done. No state doc yet means 0 cleared.
function levelsCleared(stateData) {
  if (!stateData) return 0;
  // completedOnce is sticky; phase is not. Taking the optional module retry
  // rewinds phase to 'in_progress' and currentLevel to 'easy', so deriving
  // the cleared count from those alone meant accepting a reward *un-secured
  // the module*: it dropped out of "N of 9 secured", the map node reverted,
  // and abandoning the retry left it that way until all three levels were
  // beaten again. Clearing all three levels is a thing that happened; a
  // later retry cannot unhappen it.
  if (stateData.completedOnce === true) return QUIZ_LEVELS.length;
  if (stateData.phase === 'completed') return QUIZ_LEVELS.length;
  const idx = QUIZ_LEVELS.indexOf(stateData.currentLevel);
  return idx < 0 ? 0 : idx;
}

// The name of the highest level actually cleared, or null if none yet —
// used for display (e.g. "Medium" on an employee report) rather than the
// raw 0-3 count.
function highestLevelCleared(stateData) {
  const count = levelsCleared(stateData);
  return count > 0 ? QUIZ_LEVELS[count - 1] : null;
}

module.exports = { QUIZ_LEVELS, levelsCleared, highestLevelCleared };
