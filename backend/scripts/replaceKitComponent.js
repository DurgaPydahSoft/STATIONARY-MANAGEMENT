/**
 * Replace one component product inside an already-distributed kit/set.
 *
 * Use case:
 *   Kit was created and issued to students with component A.
 *   You now want component B instead of A.
 *   Future students are fine after the kit product is updated,
 *   but EXISTING issued transactions still store the old setComponents
 *   and stock was already deducted from A.
 *
 * This script (for existing transactions):
 *   1. Updates the kit definition (setItems): A -> B
 *   2. Updates each issued kit transaction's setComponents: A -> B
 *   3. Reconciles college stock:
 *        +qty back to OLD product (A)
 *        -qty from NEW product (B)
 *
 * Modes:
 *   INSPECT (default)  - show kit, transactions, and planned stock deltas
 *   APPLY (--apply)    - write the changes
 *
 * Usage:
 *   cd backend
 *   node scripts/replaceKitComponent.js --kit-id=<kitId> --old-product-id=<id> --new-product-id=<id>
 *   node scripts/replaceKitComponent.js --kit-name="B.PHARM II - I" --old-product-id=<id> --new-product-id=<id>
 *   node scripts/replaceKitComponent.js --kit-id=<kitId> --old-product-id=<id> --new-product-id=<id> --apply
 *
 * Optional:
 *   --quantity=<n>   override per-kit quantity for the new component (default: keep old component qty)
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
    const kit = await Product.findById(KIT_ID).populate({ path: 'setItems.product', select: 'name price isSet' });
    if (!kit) throw new Error(`Kit not found for id: ${KIT_ID}`);
    return kit;
  }

  if (KIT_NAME) {
    const kits = await Product.find({
      isSet: true,
      name: { $regex: new RegExp(`^${KIT_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).populate({ path: 'setItems.product', select: 'name price isSet' });

    if (kits.length === 0) throw new Error(`Kit not found for name: ${KIT_NAME}`);
    if (kits.length > 1) {
      console.log('Multiple kits matched:');
      kits.forEach((k) => console.log(`  - ${k.name} (${k._id})`));
      throw new Error('Multiple kits matched. Pass --kit-id=<id> instead.');
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

  college.stock = Array.from(stockMap.entries()).map(([product, quantity]) => ({ product, quantity }));
  await college.save();
  return college;
}

async function run() {
  if (!OLD_PRODUCT_ID || !NEW_PRODUCT_ID) {
    throw new Error('Both --old-product-id and --new-product-id are required');
  }
  if (OLD_PRODUCT_ID === NEW_PRODUCT_ID) {
    throw new Error('Old and new product IDs are the same');
  }

  await connect();

  console.log(`\n=== Replace Kit Component ===`);
  console.log(`Mode: ${APPLY ? 'APPLY (writes to DB)' : 'INSPECT / DRY-RUN (no writes)'}`);

  const kit = await findKit();
  if (!kit.isSet) throw new Error(`Product "${kit.name}" is not a set/kit`);

  const oldProduct = await Product.findById(OLD_PRODUCT_ID).select('name price isSet').lean();
  const newProduct = await Product.findById(NEW_PRODUCT_ID).select('name price isSet').lean();

  if (!oldProduct) throw new Error(`Old product not found: ${OLD_PRODUCT_ID}`);
  if (!newProduct) throw new Error(`New product not found: ${NEW_PRODUCT_ID}`);
  if (newProduct.isSet) throw new Error('New product cannot itself be a set/kit');

  console.log(`\nKit: ${kit.name} (${kit._id})`);
  console.log(`Replace: "${oldProduct.name}" (${oldProduct._id})`);
  console.log(`With:    "${newProduct.name}" (${newProduct._id})`);

  const oldSetItem = (kit.setItems || []).find((item) => toKey(item.product) === toKey(OLD_PRODUCT_ID));
  if (!oldSetItem) {
    console.log('\nCurrent kit components:');
    (kit.setItems || []).forEach((item) => {
      const name = item.product?.name || item.productNameSnapshot || item.product;
      console.log(`  - ${name} x${item.quantity} (${toKey(item.product)})`);
    });
    throw new Error(`Old product is not currently a component of kit "${kit.name}"`);
  }

  const alreadyHasNew = (kit.setItems || []).some((item) => toKey(item.product) === toKey(NEW_PRODUCT_ID));
  if (alreadyHasNew) {
    throw new Error(`New product is already in kit "${kit.name}". Aborting to avoid duplicate component.`);
  }

  const perKitQty = QUANTITY_OVERRIDE
    ? Math.max(1, Math.round(Number(QUANTITY_OVERRIDE) || 1))
    : Number(oldSetItem.quantity) || 1;

  console.log(`\nPer-kit quantity: ${oldSetItem.quantity} -> ${perKitQty}`);

  // 1) Kit definition plan
  console.log('\n--- 1. Kit definition update ---');
  console.log(`  Remove: ${oldProduct.name} x${oldSetItem.quantity}`);
  console.log(`  Add:    ${newProduct.name} x${perKitQty}`);

  // 2) Existing issued transactions
  const transactions = await Transaction.find({
    transactionType: { $in: ['student', 'employee'] },
    'items.productId': kit._id,
    'items.isSet': true,
  }).sort({ transactionDate: -1 });

  console.log(`\n--- 2. Existing issued kit transactions ---`);
  console.log(`Found ${transactions.length} transaction(s) containing this kit.`);

  const stockChangesByCollege = new Map(); // collegeId -> Map(productId -> delta)
  let txnsWithOldComponent = 0;
  let txnsStockReconciled = 0;
  let totalOldUnitsRestored = 0;
  let totalNewUnitsDeducted = 0;

  for (const txn of transactions) {
    let touched = false;
    const collegeId = txn.collegeId || txn.branchId;
    const collegeKey = toKey(collegeId);

    for (const item of txn.items || []) {
      if (toKey(item.productId) !== toKey(kit._id) || !item.isSet) continue;

      const comps = Array.isArray(item.setComponents) ? item.setComponents : [];
      const oldCompIndex = comps.findIndex((c) => toKey(c.productId) === toKey(OLD_PRODUCT_ID));
      if (oldCompIndex === -1) continue;

      const oldComp = comps[oldCompIndex];
      const kitQty = Number(item.quantity) || 1;
      const oldReservedQty = Number(oldComp.quantity) || 0;
      const newReservedQty = kitQty * perKitQty;
      const wasTaken = oldComp.taken !== false;

      console.log(`\n  Txn: ${txn.transactionId}`);
      console.log(`    Type: ${txn.transactionType} | Paid: ${txn.isPaid} | Stock deducted: ${txn.stockDeducted}`);
      console.log(`    College: ${collegeKey || 'NONE'}`);
      if (txn.student?.name) {
        console.log(`    Student: ${txn.student.name} (${txn.student.studentId || txn.student.sqlId || ''})`);
      }
      if (txn.employee?.name) {
        console.log(`    Employee: ${txn.employee.name} (${txn.employee.empNo || ''})`);
      }
      console.log(`    Kit qty: ${kitQty}`);
      console.log(`    Component: "${oldComp.name}" x${oldReservedQty} [${wasTaken ? 'taken' : 'NOT TAKEN'}]`);
      console.log(`    Becomes:   "${newProduct.name}" x${newReservedQty}`);

      // Stock reconciliation only if this txn actually deducted stock and component was taken
      if (txn.isPaid && txn.stockDeducted && collegeKey && wasTaken) {
        if (!stockChangesByCollege.has(collegeKey)) {
          stockChangesByCollege.set(collegeKey, {
            collegeId,
            deltas: new Map(),
          });
        }
        const record = stockChangesByCollege.get(collegeKey);
        // restore old
        accumulate(record.deltas, toKey(OLD_PRODUCT_ID), oldReservedQty);
        // deduct new
        accumulate(record.deltas, toKey(NEW_PRODUCT_ID), -newReservedQty);
        totalOldUnitsRestored += oldReservedQty;
        totalNewUnitsDeducted += newReservedQty;
        txnsStockReconciled += 1;
        console.log(`    Stock: +${oldReservedQty} "${oldProduct.name}", -${newReservedQty} "${newProduct.name}"`);
      } else {
        console.log(`    Stock: skipped (paid=${txn.isPaid}, stockDeducted=${txn.stockDeducted}, taken=${wasTaken}, college=${collegeKey || 'NONE'})`);
      }

      // Update component list
      const nextComponents = comps.slice();
      nextComponents[oldCompIndex] = {
        productId: newProduct._id,
        name: newProduct.name,
        quantity: newReservedQty,
        taken: wasTaken,
        reason: wasTaken ? undefined : (oldComp.reason || 'Marked as not taken'),
      };
      item.setComponents = nextComponents;
      item.status = nextComponents.some((c) => c.taken === false) ? 'partial' : 'fulfilled';
      touched = true;
      txnsWithOldComponent += 1;
    }

    if (touched && APPLY) {
      txn.markModified('items');
      await txn.save();
      console.log(`    ✅ Transaction updated`);
    } else if (touched) {
      console.log(`    [DRY RUN] Would update transaction`);
    }
  }

  if (txnsWithOldComponent === 0) {
    console.log('\n  No issued transactions still contain the old component.');
  }

  // 3) Stock preview / apply
  console.log(`\n--- 3. College stock reconciliation ---`);
  console.log(`Transactions with old component: ${txnsWithOldComponent}`);
  console.log(`Transactions with stock change:  ${txnsStockReconciled}`);
  console.log(`Total old units restored:        ${totalOldUnitsRestored}`);
  console.log(`Total new units deducted:        ${totalNewUnitsDeducted}`);

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
        console.log(`    ${name}: ${current} -> ${projected} (${delta >= 0 ? '+' : ''}${delta})`);
        if (projected < 0) {
          console.log(`    WARNING: stock will go negative for "${name}"`);
        }
      }

      if (APPLY) {
        await applyCollegeStockChanges(record.collegeId, record.deltas);
        console.log(`    ✅ College stock updated`);
      } else {
        console.log(`    [DRY RUN] Would update college stock`);
      }
    }
  }

  // 4) Update kit definition itself
  console.log(`\n--- 4. Kit product definition ---`);
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

  console.log('New kit composition:');
  nextSetItems.forEach((item) => {
    const name =
      toKey(item.product) === toKey(NEW_PRODUCT_ID)
        ? newProduct.name
        : (kit.setItems || []).find((s) => toKey(s.product) === toKey(item.product))?.product?.name ||
          item.productNameSnapshot ||
          item.product;
    console.log(`  - ${name} x${item.quantity}`);
  });

  if (APPLY) {
    kit.setItems = nextSetItems;
    await kit.save();
    console.log('✅ Kit definition updated');
  } else {
    console.log('[DRY RUN] Would update kit definition');
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
