const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Transaction } = require('../models/transactionModel');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

const runDayReport = async () => {
  await connectDB();

  // Accept date parameter from CLI (YYYY-MM-DD), default to current date
  const inputDateStr = process.argv[2]; // e.g. "2026-05-01"
  let startOfDay, endOfDay, formattedDateStr;

  if (inputDateStr && /^\d{4}-\d{2}-\d{2}$/.test(inputDateStr)) {
    const [year, month, day] = inputDateStr.split('-').map(Number);
    startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    formattedDateStr = inputDateStr;
  } else {
    const now = new Date();
    startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const yyyy = startOfDay.getFullYear();
    const mm = String(startOfDay.getMonth() + 1).padStart(2, '0');
    const dd = String(startOfDay.getDate()).padStart(2, '0');
    formattedDateStr = `${yyyy}-${mm}-${dd}`;
  }

  if (isNaN(startOfDay.getTime())) {
    console.error('Invalid date format! Please pass date as YYYY-MM-DD (e.g. 2026-05-01)');
    process.exit(1);
  }

  console.log(`\n================================================================================`);
  console.log(`                       DAY END TRANSACTION REPORT (${formattedDateStr})         `);
  console.log(`================================================================================\n`);

  // Query transactions in range
  const transactions = await Transaction.find({
    transactionDate: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ transactionDate: 1 }).lean();

  if (transactions.length === 0) {
    console.log(`No transactions found for date: ${formattedDateStr}`);
    process.exit(0);
  }

  console.log(`Found ${transactions.length} total transaction(s) on ${formattedDateStr}.\n`);

  let totalRevenue = 0;
  let totalPaidAmount = 0;
  let totalCashAmount = 0;
  let totalOnlineAmount = 0;
  let paidCount = 0;
  let unpaidCount = 0;

  const itemsSoldMap = new Map();

  const isOnlineMethod = (method) => ['online', 'gpay', 'phonepe', 'net banking'].includes((method || '').toLowerCase());

  transactions.forEach((t, idx) => {
    const method = (t.paymentMethod || '').toLowerCase();
    const isPaid = Boolean(t.isPaid);
    const amount = t.totalAmount || 0;

    let cashPortion = 0;
    let onlinePortion = 0;

    if (isPaid) {
      paidCount++;
      totalPaidAmount += amount;

      if (method === 'cash') {
        cashPortion = amount;
      } else if (isOnlineMethod(method)) {
        onlinePortion = amount;
      } else if (method === 'split') {
        cashPortion = Number(t.cashAmount) || 0;
        onlinePortion = Number(t.onlineAmount) || 0;
      }
    } else {
      unpaidCount++;
    }

    totalRevenue += amount;
    totalCashAmount += cashPortion;
    totalOnlineAmount += onlinePortion;

    // Display single transaction details
    let entityInfo = 'N/A';
    if (t.transactionType === 'student') {
      entityInfo = `Student: ${t.student?.name || 'N/A'} (PIN/ID: ${t.student?.pin || t.student?.studentId || 'N/A'})`;
    } else if (t.transactionType === 'employee') {
      entityInfo = `Employee: ${t.employee?.name || 'N/A'} (EmpNo: ${t.employee?.empNo || 'N/A'})`;
    } else if (t.transactionType === 'college_transfer' || t.transactionType === 'branch_transfer') {
      entityInfo = `College Transfer: ${t.collegeTransfer?.collegeName || t.branchTransfer?.branchName || 'N/A'}`;
    }

    console.log(`[${idx + 1}] ID: ${t.transactionId} | Type: ${t.transactionType || 'student'} | Paid: ${isPaid ? 'YES' : 'NO'}`);
    console.log(`    Party: ${entityInfo}`);
    console.log(`    Payment Method: ${t.paymentMethod?.toUpperCase()} | Total: ₹${amount}`);
    if (method === 'split') {
      console.log(`    -> SPLIT BREAKDOWN: Cash = ₹${cashPortion} | Online = ₹${onlinePortion}`);
    }
    console.log(`    Date: ${new Date(t.transactionDate).toLocaleString()}`);
    console.log(`    Items:`);

    (t.items || []).forEach(item => {
      const setQuantity = Number(item.quantity) || 0;
      const setComponents = Array.isArray(item.setComponents) ? item.setComponents : [];
      const isSet = item.isSet || setComponents.length > 0;

      console.log(`      - ${item.name} | Qty: ${setQuantity} | Price: ₹${item.price} | Subtotal: ₹${item.total}${isSet ? ' (SET)' : ''}`);

      if (isPaid && (t.transactionType === 'student' || t.transactionType === 'employee' || !t.transactionType)) {
        if (isSet && setComponents.length > 0) {
          setComponents.forEach(comp => {
            const compName = comp.name || comp.productNameSnapshot || 'N/A';
            const compQty = Number(comp.quantity) || 1;
            const totalCompQty = compQty * setQuantity;
            itemsSoldMap.set(compName, (itemsSoldMap.get(compName) || 0) + totalCompQty);
          });
        } else {
          const itemName = item.name || 'N/A';
          itemsSoldMap.set(itemName, (itemsSoldMap.get(itemName) || 0) + setQuantity);
        }
      }
    });

    console.log('--------------------------------------------------------------------------------');
  });

  // Items summary sorted by quantity
  const sortedItemsSold = Array.from(itemsSoldMap.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  const totalItemsSoldQuantity = sortedItemsSold.reduce((sum, item) => sum + item.quantity, 0);

  console.log(`\n================================================================================`);
  console.log(`                            DAY SUMMARY STATISTICS                              `);
  console.log(`================================================================================`);
  console.log(` Total Transactions : ${transactions.length} (${paidCount} Paid, ${unpaidCount} Unpaid)`);
  console.log(` Gross Total Amount  : ₹${totalRevenue.toFixed(2)}`);
  console.log(` Paid Amount Total  : ₹${totalPaidAmount.toFixed(2)}`);
  console.log(`   ├── Cash Total   : ₹${totalCashAmount.toFixed(2)}`);
  console.log(`   └── Online Total : ₹${totalOnlineAmount.toFixed(2)}`);
  console.log(` Total Items Sold   : ${totalItemsSoldQuantity}`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(` Item Breakdown (Paid Student/Employee Sales):`);
  if (sortedItemsSold.length === 0) {
    console.log(`   (No paid student/employee item sales recorded)`);
  } else {
    sortedItemsSold.forEach(item => {
      console.log(`   - ${item.name.padEnd(40, ' ')} : ${item.quantity}`);
    });
  }
  console.log(`================================================================================\n`);

  process.exit(0);
};

runDayReport();
