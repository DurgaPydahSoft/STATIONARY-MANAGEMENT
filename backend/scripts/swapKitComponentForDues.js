/**
 * Swap an already-distributed kit component to a NEW product and reconcile stock.
 *
 * Your case:
 *   - Kit was issued; old component may already be delivered (taken=true)
 *     OR waiting because of zero stock (taken=false)
 *   - You want the stock count moved to / deducted from the NEW product
 *   - Waiting students should appear in Zero Stock Dues
 *
 * What this script does:
 *   1. Updates kit definition: old component → new component
 *   2. Updates existing issued kit transactions' setComponents
 *   3. Stock reconciliation per college:
 *        ALWAYS restore the OLD product reservation that was deducted earlier
 *        If component was TAKEN (delivered):
 *          deduct the NEW product now
 *        If component was NOT TAKEN (waiting / zero stock):
 *          do NOT deduct the new product yet
 *          keep taken=false so they show in Dashboard → Zero Stock Dues
 *          later "Mark as Taken" will deduct the NEW product
 *   4. Prints two reports:
 *        - Delivered (stock moved to new product)
 *        - Zero Stock Dues waiting list (new product, not taken yet)
 *
 * Usage:
 *   cd backend
 *   node scripts/swapKitComponentForDues.js --kit-id=<id> --old-product-id=<id> --new-product-id=<id>
 *   node scripts/swapKitComponentForDues.js --kit-name="B.PHARM II - I" --old-product-id=<id> --new-product-id=<id>
 *   node scripts/swapKitComponentForDues.js --kit-id=<id> --old-product-id=<id> --new-product-id=<id> --apply
 *
 * Optional:
 *   --quantity=<n>   per-kit qty for the new component (default: keep old qty)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const { Product } = require('../models/productModel');
const { Transaction } = require('../models/transactionModel');
const { College } = require('../models/collegeModel');

const getArg = (prefix) => {
  const arg = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return arg ? arg.split('=').slice(1).join('=').trim() : '';
};

const APPLY = process.argv.includes('--apply');
const KIT_ID = getArg('--kit-id');
const KIT_NAME = getArg('--kit-name');
const OLD_PRODUCT_ID = getArg('--old-product-id');
const NEW_PRODUCT_ID = getArg('--new-product-id');
const QUANTITY_OVERRIDE = getArg('--quantity');

const toKey = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
};

const accumulate = (map, key, delta) => {
  if (!key || !Number.isFinite(delta) || delta === 0) return;
  map.set(key, (map.get(key) || 0) + delta);
};

async function connect() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be defined in backend/.env');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
}

async function findKit() {
  if (KIT_ID) {
    const kit = await Product.findById(KIT_ID).populate({
      path: 'setItems.product',
      select: 'name price isSet',
    });
    if (!kit) throw new Error(`Kit not found for id: ${KIT_ID}`);
    return kit;
  }

  if (KIT_NAME) {
    const kits = await Product.find({
      isSet: true,
      name: {
        $regex: new RegExp(`^${KIT_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      },
    }).populate({ path: 'setItems.product', select: 'name price isSet' });

    if (kits.length === 0) throw new Error(`Kit not found for name: ${KIT_NAME}`);
    if (kits.length > 1) {
      kits.forEach((k) => console.log(`  - ${k.name} (${k._id})`));
      throw new Error('Multiple kits matched. Pass --kit-id=<id>.');
    }
    return kits[0];
  }

  throw new Error('Provide --kit-id=<id> or --kit-name="Kit Name"');
}

function getCollegeStockQty(college, productId) {
  const entry = (college.stock || []).find((s) => toKey(s.product) === toKey(productId));
  return entry ? Number(entry.quantity) || 0 : 0;
}

async function applyCollegeStockChanges(collegeId, deltaMap) {
  const college = await College.findById(collegeId);
  if (!college) throw new Error(`College not found: ${collegeId}`);

  const stockMap = new Map();
  (college.stock || []).forEach((entry) => {
    stockMap.set(toKey(entry.product), Number(entry.quantity) || 0);
  });

  deltaMap.forEach((delta, productId) => {
    stockMap.set(productId, (stockMap.get(productId) || 0) + delta);
  });

  college.stock = Array.from(stockMap.entries()).map(([product, quantity]) => ({
    product,
    quantity,
  }));
  await college.save();
}

function personLabel(txn) {
  if (txn.student?.name) {
    return `${txn.student.name} | ${txn.student.studentId || txn.student.sqlId || ''}`.trim();
  }
  if (txn.employee?.name) {
    return `${txn.employee.name} | emp ${txn.employee.empNo || ''}`.trim();
  }
  return 'Unknown';
}

async function run() {
  if (!OLD_PRODUCT_ID || !NEW_PRODUCT_ID) {
    throw new Error('Both --old-product-id and --new-product-id are required');
  }
  if (OLD_PRODUCT_ID === NEW_PRODUCT_ID) {
    throw new Error('Old and new product IDs are the same');
  }

  await connect();

  console.log(`\n=== Swap Kit Component (Delivered + Zero Stock Dues) ===`);
  console.log(`Mode: ${APPLY ? 'APPLY (writes to DB)' : 'INSPECT / DRY-RUN (no writes)'}`);

  const kit = await findKit();
  if (!kit.isSet) throw new Error(`"${kit.name}" is not a set/kit`);

  const oldProduct = await Product.findById(OLD_PRODUCT_ID).select('name price isSet').lean();
  const newProduct = await Product.findById(NEW_PRODUCT_ID).select('name price isSet').lean();
  if (!oldProduct) throw new Error(`Old product not found: ${OLD_PRODUCT_ID}`);
  if (!newProduct) throw new Error(`New product not found: ${NEW_PRODUCT_ID}`);
  if (newProduct.isSet) throw new Error('New product cannot itself be a set');

  console.log(`\nKit: ${kit.name} (${kit._id})`);
  console.log(`Old: ${oldProduct.name} (${oldProduct._id})`);
  console.log(`New: ${newProduct.name} (${newProduct._id})`);

  const oldSetItem = (kit.setItems || []).find(
    (item) => toKey(item.product) === toKey(OLD_PRODUCT_ID)
  );
  if (!oldSetItem) {
    console.log('\nCurrent kit components:');
    (kit.setItems || []).forEach((item) => {
      const name = item.product?.name || item.productNameSnapshot || item.product;
      console.log(`  - ${name} x${item.quantity} (${toKey(item.product)})`);
    });
    throw new Error(`Old product is not in kit "${kit.name}"`);
  }

  const alreadyHasNew = (kit.setItems || []).some(
    (item) => toKey(item.product) === toKey(NEW_PRODUCT_ID)
  );
  if (alreadyHasNew) {
    throw new Error(`New product is already in kit "${kit.name}"`);
  }

  const perKitQty = QUANTITY_OVERRIDE
    ? Math.max(1, Math.round(Number(QUANTITY_OVERRIDE) || 1))
    : Number(oldSetItem.quantity) || 1;

  const transactions = await Transaction.find({
    transactionType: { $in: ['student', 'employee'] },
    'items.productId': kit._id,
    'items.isSet': true,
  }).sort({ transactionDate: -1 });

  console.log(`\nFound ${transactions.length} kit transaction(s).`);

  const stockChangesByCollege = new Map();
  const deliveredReport = [];
  const waitingReport = [];

  let txnsTouched = 0;
  let deliveredCount = 0;
  let waitingCount = 0;
  let restoredOldUnits = 0;
  let deductedNewUnits = 0;

  for (const txn of transactions) {
    let touched = false;
    const collegeId = txn.collegeId || txn.branchId;
    const collegeKey = toKey(collegeId);

    for (const item of txn.items || []) {
      if (toKey(item.productId) !== toKey(kit._id) || !item.isSet) continue;

      const comps = Array.isArray(item.setComponents) ? [...item.setComponents] : [];
      const oldIdx = comps.findIndex((c) => toKey(c.productId) === toKey(OLD_PRODUCT_ID));
      if (oldIdx === -1) continue;

      const oldComp = comps[oldIdx];
      const kitQty = Number(item.quantity) || 1;
      const oldReservedQty = Number(oldComp.quantity) || 0;
      const newReservedQty = kitQty * perKitQty;
      const wasTaken = oldComp.taken !== false;

      const row = {
        transactionId: txn.transactionId,
        person: personLabel(txn),
        collegeId: collegeKey || 'NONE',
        kitName: item.name,
        kitQty,
        oldQty: oldReservedQty,
        newQty: newReservedQty,
        wasTaken,
        paid: Boolean(txn.isPaid),
        stockDeducted: Boolean(txn.stockDeducted),
      };

      // Stock: always restore old if this txn previously deducted stock
      // (even when taken=false, older create flow deducted and could go negative)
      if (txn.isPaid && txn.stockDeducted && collegeKey) {
        if (!stockChangesByCollege.has(collegeKey)) {
          stockChangesByCollege.set(collegeKey, { collegeId, deltas: new Map() });
        }
        const record = stockChangesByCollege.get(collegeKey);
        accumulate(record.deltas, toKey(OLD_PRODUCT_ID), oldReservedQty);
        restoredOldUnits += oldReservedQty;

        if (wasTaken) {
          accumulate(record.deltas, toKey(NEW_PRODUCT_ID), -newReservedQty);
          deductedNewUnits += newReservedQty;
        }
      }

      const nextTaken = wasTaken;
      // Critical: avoid double deduction on Mark as Taken
      // - Delivered: stockReserved=true (already deducted new above)
      // - Waiting: stockReserved=false after restoring old — Mark as Taken will deduct NEW once
      comps[oldIdx] = {
        productId: newProduct._id,
        name: newProduct.name,
        quantity: newReservedQty,
        taken: nextTaken,
        stockReserved: nextTaken, // true only if we deducted new now
        reason: nextTaken
          ? undefined
          : oldComp.reason ||
            `Waiting for stock of ${newProduct.name} (replaced from ${oldProduct.name})`,
      };

      item.setComponents = comps;
      item.status = comps.some((c) => c.taken === false) ? 'partial' : 'fulfilled';
      touched = true;

      if (wasTaken) {
        deliveredCount += 1;
        deliveredReport.push(row);
      } else {
        waitingCount += 1;
        waitingReport.push(row);
      }
    }

    if (touched) {
      txnsTouched += 1;
      if (APPLY) {
        txn.markModified('items');
        await txn.save();
      }
    }
  }

  // Stock preview / apply
  console.log(`\n--- College stock reconciliation ---`);
  console.log(`Transactions updated:           ${txnsTouched}`);
  console.log(`Delivered (deduct new now):     ${deliveredCount}`);
  console.log(`Waiting / zero-stock dues:      ${waitingCount}`);
  console.log(`Old units restored:             ${restoredOldUnits}`);
  console.log(`New units deducted (delivered): ${deductedNewUnits}`);

  if (stockChangesByCollege.size === 0) {
    console.log('No college stock changes needed.');
  } else {
    for (const [collegeKey, record] of stockChangesByCollege.entries()) {
      const college = await College.findById(record.collegeId).select('name stock').lean();
      console.log(`\n  College: ${college?.name || 'Unknown'} (${collegeKey})`);
      for (const [productId, delta] of record.deltas.entries()) {
        const current = college ? getCollegeStockQty(college, productId) : 0;
        const projected = current + delta;
        const name =
          productId === toKey(OLD_PRODUCT_ID)
            ? oldProduct.name
            : productId === toKey(NEW_PRODUCT_ID)
              ? newProduct.name
              : productId;
        console.log(
          `    ${name}: ${current} -> ${projected} (${delta >= 0 ? '+' : ''}${delta})`
        );
        if (projected < 0) {
          console.log(`    WARNING: "${name}" will go negative`);
        }
      }
      if (APPLY) {
        await applyCollegeStockChanges(record.collegeId, record.deltas);
        console.log('    ✅ Stock updated');
      } else {
        console.log('    [DRY RUN] Would update stock');
      }
    }
  }

  // Kit definition
  console.log(`\n--- Kit definition ---`);
  const nextSetItems = (kit.setItems || []).map((item) => {
    if (toKey(item.product) !== toKey(OLD_PRODUCT_ID)) {
      return {
        product: item.product?._id || item.product,
        quantity: item.quantity,
        productNameSnapshot: item.productNameSnapshot || item.product?.name || '',
        productPriceSnapshot: item.productPriceSnapshot || item.product?.price || 0,
      };
    }
    return {
      product: newProduct._id,
      quantity: perKitQty,
      productNameSnapshot: newProduct.name,
      productPriceSnapshot: newProduct.price || 0,
    };
  });
  nextSetItems.forEach((item) => {
    const name =
      toKey(item.product) === toKey(NEW_PRODUCT_ID)
        ? newProduct.name
        : item.productNameSnapshot || item.product;
    console.log(`  - ${name} x${item.quantity}`);
  });
  if (APPLY) {
    kit.setItems = nextSetItems;
    await kit.save();
    console.log('✅ Kit definition updated');
  } else {
    console.log('[DRY RUN] Would update kit definition');
  }

  // Reports
  console.log(`\n=== DELIVERED — stock moved to "${newProduct.name}" (${deliveredReport.length}) ===`);
  if (deliveredReport.length === 0) {
    console.log('(none)');
  } else {
    deliveredReport.forEach((r, i) => {
      console.log(
        `${i + 1}. ${r.person} | txn ${r.transactionId} | kit "${r.kitName}" x${r.kitQty} | ${oldProduct.name} x${r.oldQty} -> ${newProduct.name} x${r.newQty}`
      );
    });
  }

  console.log(
    `\n=== ZERO STOCK DUES — waiting for "${newProduct.name}" (${waitingReport.length}) ===`
  );
  console.log(
    '\n(These stay taken=false with stockReserved=false and appear in Dashboard → Zero Stock Dues.\n' +
      ' Mark as Taken later deducts the NEW product once — not double, because old reservation was restored.)'
  );
  if (waitingReport.length === 0) {
    console.log('(none)');
  } else {
    waitingReport.forEach((r, i) => {
      console.log(
        `${i + 1}. ${r.person} | txn ${r.transactionId} | kit "${r.kitName}" | waiting: ${newProduct.name} x${r.newQty}`
      );
    });
  }

  console.log(`\n=== ${APPLY ? 'APPLY COMPLETE' : 'DRY RUN COMPLETE'} ===`);
  if (!APPLY) {
    console.log('Re-run with --apply to write these changes.');
  }
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
