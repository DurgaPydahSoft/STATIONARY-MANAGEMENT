/**
 * Academic year labels (e.g. 2025-26) for kit catalogue tagging.
 * Kits use academicYears + student batch to determine applicability at runtime.
 */

/** @param {number} startYear first calendar year of the academic year */
export const formatAcademicYearLabel = (startYear) => {
  const end = startYear + 1;
  return `${startYear}-${String(end).slice(-2)}`;
};

/**
 * Academic year start (June rollover — common in Indian colleges).
 * Jan–May → previous calendar year's AY; Jun–Dec → current calendar year's AY.
 */
export const getCurrentAcademicYearStart = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan
  return month >= 5 ? year : year - 1;
};

/**
 * Past 3, current, and next 3 academic years (7 options total).
 */
export const getAcademicYearOptions = (date = new Date()) => {
  const currentStart = getCurrentAcademicYearStart(date);
  const options = [];
  for (let offset = -3; offset <= 3; offset += 1) {
    options.push(formatAcademicYearLabel(currentStart + offset));
  }
  return options;
};

export const getDefaultAcademicYear = (date = new Date()) =>
  formatAcademicYearLabel(getCurrentAcademicYearStart(date));

/**
 * Normalize batch labels to "YYYY-YY" (e.g. 2025-26) for comparison.
 */
export const normalizeAcademicYearLabel = (value) => {
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

/**
 * Infer intake academic year from study year + current calendar AY.
 */
export const inferStudentIntakeAcademicYear = (student, date = new Date()) => {
  const studentYear = Number(student?.year);
  if (!studentYear || studentYear < 1) return null;
  const intakeStart = getCurrentAcademicYearStart(date) - (studentYear - 1);
  return formatAcademicYearLabel(intakeStart);
};

/** Parse intake/joining year from SQL batch (e.g. 2024, or 2024-25 → 2024). */
export const parseBatchStartYear = (student) => {
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
export const parseAcademicYearStart = (label) => {
  const normalized = normalizeAcademicYearLabel(label);
  const match = normalized.match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
};

/**
 * Study year for a student in the current academic year from batch.
 * Batch 2024 in AY 2025-26 → year 2.
 */
export const getExpectedStudyYearForStudent = (student, date = new Date()) => {
  const batchStart = parseBatchStartYear(student);
  if (!batchStart) return null;
  const ayStart = getCurrentAcademicYearStart(date);
  return ayStart - batchStart + 1;
};

/** Student SQL batch as academic year label when stored as YYYY-YY. */
export const getStudentAcademicYear = (student, date = new Date()) => {
  const fromSql = student?.batch || student?.academicYear;
  if (fromSql && String(fromSql).trim()) {
    return normalizeAcademicYearLabel(fromSql);
  }
  const inferred = inferStudentIntakeAcademicYear(student, date);
  return inferred ? normalizeAcademicYearLabel(inferred) : '';
};
