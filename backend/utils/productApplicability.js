/**
 * Shared rules for matching academic products/kits to a student.
 * Kits with academicYears are matched using student batch + current academic year.
 */

const {
  getDefaultAcademicYear,
  normalizeAcademicYearLabel,
  parseBatchStartYear,
  getExpectedStudyYearForStudent,
} = require('./academicYears');

const normalizeCourse = (value) => {
  if (!value) return '';
  if (/^[0-9a-fA-F]{24}$/.test(String(value))) return String(value);
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

const normalizeAcademicYear = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

const getProductYears = (product) => {
  if (!product) return [];
  const fromArray = Array.isArray(product.years) ? product.years : [];
  const normalized = fromArray.map(Number).filter((y) => !Number.isNaN(y) && y > 0);
  if (normalized.length > 0) return normalized;
  const fallback = Number(product.year);
  if (!Number.isNaN(fallback) && fallback > 0) return [fallback];
  return [];
};

const getProductAcademicYears = (product) => {
  if (!product || !Array.isArray(product.academicYears)) return [];
  return product.academicYears
    .map((y) => String(y).trim())
    .filter(Boolean);
};

/**
 * Kits tagged with academicYears apply only when:
 * 1. The kit's academic year matches the current academic year
 * 2. The student's batch implies the kit's configured study year in that AY
 *    (batch 2024 + AY 2025-26 → 2nd year)
 */
const kitMatchesStudentBatchAndAcademicYear = (product, student, date = new Date()) => {
  if (!product?.isSet) return true;

  const kitAcademicYears = getProductAcademicYears(product);
  if (kitAcademicYears.length === 0) return true;

  const studentBatch = parseBatchStartYear(student);
  if (!studentBatch) return false;

  const currentAyLabel = normalizeAcademicYearLabel(getDefaultAcademicYear(date));
  const kitForCurrentAy = kitAcademicYears.some(
    (ay) => normalizeAcademicYearLabel(ay) === currentAyLabel
  );
  if (!kitForCurrentAy) return false;

  const expectedStudyYear = getExpectedStudyYearForStudent(student, date);
  if (!expectedStudyYear || expectedStudyYear < 1) return false;

  const productYears = getProductYears(product);
  if (productYears.length === 0) return false;

  return productYears.includes(expectedStudyYear);
};

/**
 * @param {object} product - Mongo product document
 * @param {object} student - normalized student ({ course, courseId, year, semester, branch, branchId })
 * @returns {boolean}
 */
const productAppliesToStudent = (product, student) => {
  if (!product || !student) return false;

  if (product.applicabilityMode === 'students') {
    const sid1 = String(student.id || student._id || '');
    const sid2 = String(student.studentId || '');
    const allowedIds = (product.applicableStudents || []).map((id) => {
      if (id && typeof id === 'object') return String(id._id || id.id || '');
      return String(id);
    });
    return allowedIds.includes(sid1) || allowedIds.includes(sid2);
  }

  if (!product.forCourse && !product.forCourseId) return false;

  if (product.forCourseId && student.courseId) {
    if (Number(product.forCourseId) !== Number(student.courseId)) return false;
  } else if (product.forCourse) {
    if (normalizeCourse(product.forCourse) !== normalizeCourse(student.course)) return false;
  }

  const productYears = getProductYears(product);
  const kitAcademicYears = getProductAcademicYears(product);

  if (product.isSet && kitAcademicYears.length > 0) {
    if (!kitMatchesStudentBatchAndAcademicYear(product, student)) return false;
  } else if (productYears.length > 0) {
    const studentYear = Number(student.year);
    if (!studentYear || !productYears.includes(studentYear)) return false;
  }

  const productBranchIds = Array.isArray(product.branchIds) ? product.branchIds : [];
  if (productBranchIds.length > 0 && student.branchId) {
    if (!productBranchIds.includes(Number(student.branchId))) return false;
  } else {
    const productBranches = Array.isArray(product.branch)
      ? product.branch
      : product.branch
        ? [product.branch]
        : [];
    if (productBranches.length > 0) {
      const studentBranch = normalizeCourse(student.branch || '');
      const normalizedBranches = productBranches.map((b) =>
        normalizeCourse(typeof b === 'object' ? b.name : b)
      );
      if (!normalizedBranches.includes(studentBranch)) return false;
    }
  }

  const productSemesters = Array.isArray(product.semesters) ? product.semesters : [];
  const studentSemester = Number(student.semester);
  if (productSemesters.length > 0) {
    if (!studentSemester || !productSemesters.includes(studentSemester)) return false;
  }

  return true;
};

module.exports = {
  normalizeCourse,
  normalizeAcademicYear,
  getProductYears,
  getProductAcademicYears,
  kitMatchesStudentBatchAndAcademicYear,
  productAppliesToStudent,
};
