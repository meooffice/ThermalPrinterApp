// services/AcademicYear.js
// Academic year = April to March, written "2026-27". Pure helpers, no storage.

/** The academic year a date belongs to (April..March). */
export function currentAcademicYear(date = new Date()) {
  const y = date.getFullYear();
  const start = date.getMonth() >= 3 ? y : y - 1;          // getMonth(): 0 = Jan, 3 = Apr
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** "2026-27" is valid; "2026-28", "26-27", "2026/27" are not. */
export function isValidAcademicYear(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) return false;
  const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
  return a >= 2000 && a <= 2099 && b === (a + 1) % 100;
}

/** "2026-27" -> "2027-28" */
export function nextAcademicYear(ay) {
  const start = parseInt(String(ay).slice(0, 4), 10) + 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}