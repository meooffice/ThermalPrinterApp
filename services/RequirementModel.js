// services/RequirementModel.js
// Pure helpers: how many pieces of each item are REQUIRED, from the school rolls (no storage here).
//
// Required(item) = sum over schools, over the item's classes that the school has (Min..Max),
//                  of  students(class, item.subType) x per-student count of that class
//   students: Common = boys + girls, Boys = boys, Girls = girls
//   per-student count: item.perStudent[class]; missing = 1; 0 = not given in that class
import { effectiveClasses } from './ItemModel';
import { classRange, rollSummary } from './SchoolModel';

function studentsOf(roll, subType) {
  const b = Number(roll?.b) || 0, g = Number(roll?.g) || 0;
  if (subType === 'Boys')  return b;
  if (subType === 'Girls') return g;
  return b + g;
}

/** Pieces of ONE item needed by ONE school (0 if the school has no roll / the item does not apply). */
export function requiredForSchool(item, school) {
  const have = new Set(classRange(school?.minClass, school?.maxClass));
  let qty = 0;
  effectiveClasses(item.classFrom, item.classTo).forEach(c => {
    if (!have.has(c)) return;
    const raw  = item.perStudent ? item.perStudent[String(c)] : undefined;
    const norm = raw === undefined || raw === null || raw === '' ? 1 : Number(raw);
    if (!(norm > 0)) return;
    qty += studentsOf(school.roll?.[c], item.subType) * norm;
  });
  return qty;
}

/**
 * -> { byItem: { [itemId]: { required, schools: [{ id, name, qty }] } },
 *      noRoll: [{ id, name }],        // schools with no roll entered (Min-Max not set or all zero)
 *      schoolCount, rollSchoolCount }
 */
export function computeRequirement(items, schools) {
  const list = Array.isArray(schools) ? schools : [];
  const noRoll = [];
  const rollSchools = [];
  list.forEach(s => {
    if (rollSummary(s).total > 0) rollSchools.push(s);
    else noRoll.push({ id: s.id, name: s.name });
  });

  const byItem = {};
  (items || []).forEach(item => {
    let required = 0;
    const per = [];
    rollSchools.forEach(s => {
      const qty = requiredForSchool(item, s);
      if (qty > 0) { required += qty; per.push({ id: s.id, name: s.name, qty }); }
    });
    per.sort((a, b) => b.qty - a.qty);
    byItem[item.id] = { required, schools: per };
  });

  return { byItem, noRoll, schoolCount: list.length, rollSchoolCount: rollSchools.length };
}

/** Items already given to a school MORE than the school's (new) requirement: [{ name, required, given }] */
export function rollConflicts(items, school, given) {
  const out = [];
  (items || []).forEach(item => {
    const g = Number(given?.[item.id]) || 0;
    if (g <= 0) return;
    const required = requiredForSchool(item, school);
    if (required < g) out.push({ name: item.name, required, given: g });
  });
  return out;
}