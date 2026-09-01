/**
 * Academic year helpers (mirrors frontend/src/utils/academicYears.js).
 */

const formatAcademicYearLabel = (startYear) => {
  const end = startYear + 1;
  return `${startYear}-${String(end).slice(-2)}`;
};

const getCurrentAcademicYearStart = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= 5 ? year : year - 1;
};

const getDefaultAcademicYear = (date = new Date()) =>
  formatAcademicYearLabel(getCurrentAcademicYearStart(date));

const inferStudentIntakeAcademicYear = (student, date = new Date()) => {
  const studentYear = Number(student?.year);
  if (!studentYear || studentYear < 1) return null;
  const intakeStart = getCurrentAcademicYearStart(date) - (studentYear - 1);
  return formatAcademicYearLabel(intakeStart);
};

const normalizeAcademicYearLabel = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim().toLowerCase();
  if (!str) return '';

  const shortMatch = str.match(/^(\d{4})-(\d{2,4})$/);
  if (shortMatch) {
    const start = shortMatch[1];
    const endPart = shortMatch[2];
    const end = endPart.length === 2 ? endPart : endPart.slice(-2);
    return `${start}-${end}`;
  }

  const yearOnly = str.match(/^(\d{4})$/);
  if (yearOnly) {
    return formatAcademicYearLabel(Number(yearOnly[1]));
  }

  return str;
};

/** Parse intake/joining year from SQL batch (e.g. 2024, or 2024-25 → 2024). */
const parseBatchStartYear = (student) => {
  const raw = student?.batch || student?.academicYear;
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;

  const str = String(raw).trim();
  const yearOnly = str.match(/^(\d{4})$/);
  if (yearOnly) return Number(yearOnly[1]);

  const ayMatch = str.match(/^(\d{4})-/);
  if (ayMatch) return Number(ayMatch[1]);

  return null;
};

/** Parse academic year label start year (e.g. 2025-26 → 2025). */
const parseAcademicYearStart = (label) => {
  const normalized = normalizeAcademicYearLabel(label);
  const match = normalized.match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
};

/**
 * Study year for a student in the current academic year from batch.
 * Batch 2024 in AY 2025-26 → year 2.
 */
const getExpectedStudyYearForStudent = (student, date = new Date()) => {
  const batchStart = parseBatchStartYear(student);
  if (!batchStart) return null;
  const ayStart = getCurrentAcademicYearStart(date);
  return ayStart - batchStart + 1;
};

/** Student SQL batch as academic year label when stored as YYYY-YY. */
const getStudentAcademicYear = (student, date = new Date()) => {
  const fromSql = student?.batch || student?.academicYear;
  if (fromSql && String(fromSql).trim()) {
    return normalizeAcademicYearLabel(fromSql);
  }
  const inferred = inferStudentIntakeAcademicYear(student, date);
  return inferred ? normalizeAcademicYearLabel(inferred) : '';
};

module.exports = {
  formatAcademicYearLabel,
  getCurrentAcademicYearStart,
  getDefaultAcademicYear,
  inferStudentIntakeAcademicYear,
  normalizeAcademicYearLabel,
  parseBatchStartYear,
  parseAcademicYearStart,
  getExpectedStudyYearForStudent,
  getStudentAcademicYear,
};
