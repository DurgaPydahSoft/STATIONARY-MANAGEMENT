/**
 * Find associated set/kit products for a student (read-only).
 *
 * 1. Looks up the student in MySQL by name
 * 2. Lists all kit products that match the student (course/year/branch/semester rules)
 * 3. Shows which kits are Pending vs Issued (same logic as StudentDetail)
 * 4. Prints related paid transactions and setComponents
 *
 * Usage:
 *   cd backend
 *   node scripts/findStudentSets.js
 *   node scripts/findStudentSets.js --name="GEDDADA AAMRAPAALI"
 *   node scripts/findStudentSets.js --admission=20259058 --pin=25D51R0026 --course="B.PHARM"
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const { getMySqlPool } = require('../config/mysql');
const { normalizeStudentRow } = require('../controllers/sqlStudentController');
const { Product } = require('../models/productModel');
const { Transaction } = require('../models/transactionModel');
const { productAppliesToStudent } = require('../utils/productApplicability');

// ------------------------- CONFIG -------------------------
const DEFAULT_STUDENT_NAME = 'GEDDADA AAMRAPAALI';
const DEFAULT_ADMISSION = '20259058';
const DEFAULT_PIN = '25D51R0026';
const DEFAULT_COURSE = 'B.PHARM';
// ---------------------------------------------------------

const getArg = (prefix) => {
  const arg = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return arg ? arg.split('=').slice(1).join('=').trim() : '';
};

const hasCliArgs = process.argv.some((a) =>
  ['--name=', '--admission=', '--pin=', '--course='].some((prefix) => a.startsWith(prefix))
);

const SEARCH = {
  name: getArg('--name') || (hasCliArgs ? '' : DEFAULT_STUDENT_NAME),
  admission: getArg('--admission') || (hasCliArgs ? '' : DEFAULT_ADMISSION),
  pin: getArg('--pin') || (hasCliArgs ? '' : DEFAULT_PIN),
  course: getArg('--course') || (hasCliArgs ? '' : DEFAULT_COURSE),
};

const normalizeItemKey = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/\s+/g, '_');
};

const fmtDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString('en-IN');
  } catch {
    return String(value);
  }
};

async function connectMongo() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be defined in backend/.env');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
}

async function findStudents(search) {
  const pool = getMySqlPool();
  if (!pool) throw new Error('MySQL pool is not configured. Check DB_* vars in backend/.env');

  const tableName = process.env.DB_STUDENTS_TABLE || 'students';
  const conditions = [];
  const params = [];

  if (search.admission) {
    conditions.push('(admission_number = ? OR admission_no = ?)');
    params.push(search.admission, search.admission);
  }

  if (search.pin) {
    conditions.push('pin_no = ?');
    params.push(search.pin);
  }

  if (search.name) {
    const likePattern = `%${search.name.trim().replace(/\s+/g, '%')}%`;
    conditions.push('student_name LIKE ?');
    params.push(likePattern);
  }

  if (search.course) {
    conditions.push('course = ?');
    params.push(search.course);
  }

  if (conditions.length === 0) {
    throw new Error('Provide at least one search filter: --name, --admission, --pin, or --course');
  }

  const sql = `SELECT * FROM \`${tableName}\` WHERE ${conditions.join(' AND ')}`;
  const [rows] = await pool.query(sql, params);

  return (rows || []).map((row) => normalizeStudentRow(row));
}

function isKitReceived(studentItems, kit) {
  const key = normalizeItemKey(kit.name);
  const byName = Boolean(studentItems[key]);
  const byId = Boolean(studentItems[`id:${kit._id}`]);
  return byName || byId;
}

async function run() {
  await connectMongo();

  console.log(`\n=== Student Set/Kit Lookup ===`);
  console.log('Search filters:');
  if (SEARCH.name) console.log(`  name:      ${SEARCH.name}`);
  if (SEARCH.admission) console.log(`  admission: ${SEARCH.admission}`);
  if (SEARCH.pin) console.log(`  pin:       ${SEARCH.pin}`);
  if (SEARCH.course) console.log(`  course:    ${SEARCH.course}`);
  console.log('');

  const students = await findStudents(SEARCH);
  if (students.length === 0) {
    console.log('No student found with those filters.');
    return;
  }

  if (students.length > 1) {
    console.log(`Found ${students.length} matching students:\n`);
    students.forEach((student, index) => {
      console.log(
        `  [${index + 1}] ${student.name} | id: ${student.id} | studentId: ${student.studentId} | ${student.course} Y${student.year} ${student.branch}`
      );
    });
    console.log('\nShowing details for all matches.\n');
  }

  const allKits = await Product.find({ isSet: true })
    .select('_id name price forCourse forCourseId years year branch branchIds semesters academicYears applicabilityMode applicableStudents setItems')
    .populate({ path: 'setItems.product', select: 'name price' })
    .lean();

  for (const student of students) {
    console.log('--------------------------------------------------');
    console.log(`Student: ${student.name}`);
    console.log(`  SQL id:        ${student.id}`);
    console.log(`  Admission No:  ${student.studentId}`);
    console.log(`  PIN:           ${student.pin || 'N/A'}`);
    console.log(`  Course:        ${student.course}${student.courseId ? ` (courseId: ${student.courseId})` : ''}`);
    console.log(`  Year:          ${student.year}`);
    console.log(`  Branch:        ${student.branch}${student.branchId ? ` (branchId: ${student.branchId})` : ''}`);
    console.log(`  Semester:      ${student.semester ?? 'N/A'}`);

    const studentSqlId = String(student.id);
    const studentAdmissionNo = String(student.studentId);

    const transactions = await Transaction.find({
      transactionType: 'student',
      $or: [
        { 'student.sqlId': studentSqlId },
        { 'student.sqlId': studentAdmissionNo },
        { 'student.studentId': studentAdmissionNo },
        { 'student.name': { $regex: new RegExp(student.name.trim().replace(/\s+/g, '\\s+'), 'i') } },
      ],
    })
      .sort({ transactionDate: -1 })
      .lean();

    const paidTransactions = transactions.filter((txn) => txn.isPaid);
    const itemsMap = {};
    paidTransactions.forEach((txn) => {
      (txn.items || []).forEach((item) => {
        if (item.status !== 'partial') {
          const key = normalizeItemKey(item.name);
          if (key) itemsMap[key] = true;
          if (item.productId) itemsMap[`id:${item.productId}`] = true;
        }
      });
    });

    const matchedKits = allKits.filter((kit) => productAppliesToStudent(kit, student));

    console.log(`\nAssociated Sets/Kits (matched by rules): ${matchedKits.length}`);
    if (matchedKits.length === 0) {
      console.log('  No kits match this student based on course/year/branch/semester rules.');
    } else {
      matchedKits.forEach((kit, index) => {
        const received = isKitReceived(itemsMap, kit);
        console.log(`\n  [${index + 1}] ${kit.name}`);
        console.log(`      Product ID:     ${kit._id}`);
        console.log(`      Price:          ₹${Number(kit.price || 0).toFixed(2)}`);
        console.log(`      Academic year:  ${(kit.academicYears || []).join(', ') || 'N/A'}`);
        console.log(`      Status:         ${received ? 'ISSUED' : 'PENDING'}`);
        console.log(`      Components:`);
        (kit.setItems || []).forEach((setItem) => {
          const compName =
            setItem?.product?.name ||
            setItem?.productNameSnapshot ||
            setItem?.product ||
            'Unknown';
          console.log(`        - ${compName} x${setItem?.quantity || 1}`);
        });
      });
    }

    const kitTransactions = transactions
      .map((txn) => ({
        txn,
        kitItems: (txn.items || []).filter((item) => item.isSet),
      }))
      .filter((entry) => entry.kitItems.length > 0);

    console.log(`\nKit-related Transactions: ${kitTransactions.length}`);
    if (kitTransactions.length === 0) {
      console.log('  No kit transactions found for this student.');
    } else {
      kitTransactions.forEach(({ txn, kitItems }) => {
        console.log(`\n  Transaction: ${txn.transactionId}`);
        console.log(`    Date:           ${fmtDate(txn.transactionDate)}`);
        console.log(`    Paid:           ${txn.isPaid ? 'Yes' : 'No'}`);
        console.log(`    Stock deducted: ${txn.stockDeducted ? 'Yes' : 'No'}`);
        console.log(`    College ID:     ${txn.collegeId || txn.branchId || 'NONE'}`);
        kitItems.forEach((item) => {
          console.log(`    Kit: "${item.name}" x${item.quantity} | status: ${item.status || 'fulfilled'}`);
          (item.setComponents || []).forEach((comp) => {
            const compName = comp.name || comp.productId;
            const takenLabel = comp.taken === false ? 'NOT TAKEN' : 'taken';
            const reason = comp.reason ? ` (${comp.reason})` : '';
            console.log(`      - ${compName} x${comp.quantity} [${takenLabel}]${reason}`);
          });
        });
      });
    }

    const partialKitTxns = kitTransactions.filter(({ kitItems }) =>
      kitItems.some((item) => item.status === 'partial')
    );
    if (partialKitTxns.length > 0) {
      console.log(`\nNote: ${partialKitTxns.length} partial kit transaction(s) found.`);
      console.log('Partial kits stay PENDING on StudentDetail even if some components were taken.');
    }
  }

  console.log('\n--- Done ---');
}

run()
  .catch((err) => {
    console.error('\nFAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  });
