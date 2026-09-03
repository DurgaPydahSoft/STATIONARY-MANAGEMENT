const { Product } = require('../models/productModel');
const { College } = require('../models/collegeModel');
const { Transaction } = require('../models/transactionModel');
const { getMySqlPool } = require('../config/mysql');
const { normalizeStudentRow } = require('./sqlStudentController');

const resolveStudentNamesForProducts = async (products) => {
  if (!products) return products;
  
  const isArray = Array.isArray(products);
  const productsList = isArray ? products : [products];
  
  // 1. Collect all unique student IDs from 'student' mode products
  const studentIds = new Set();
  productsList.forEach(p => {
    if (p.applicabilityMode === 'students' && p.applicableStudents && Array.isArray(p.applicableStudents)) {
      p.applicableStudents.forEach(id => {
        if (id && typeof id === 'string') studentIds.add(id.trim());
        else if (id && typeof id === 'number') studentIds.add(String(id));
      });
    }
  });

  if (studentIds.size === 0) return products;

  // 2. Fetch those student records from MySQL in one batch
  const pool = getMySqlPool();
  if (!pool) return products;

  const tableName = process.env.DB_STUDENTS_TABLE || 'students';
  const idsArray = Array.from(studentIds);
  const placeholders = idsArray.map(() => '?').join(',');
  const sql = `SELECT * FROM \`${tableName}\` WHERE id IN (${placeholders})`;

  try {
    const [rows] = await pool.query(sql, idsArray);
    const studentMap = new Map();
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        const student = normalizeStudentRow(row);
        studentMap.set(String(student.id), {
          _id: String(student.id),
          name: student.name,
          studentId: student.studentId
        });
      });
    }

    // 3. Map IDs back to objects for frontend compatibility
    productsList.forEach(p => {
      if (p.applicabilityMode === 'students' && Array.isArray(p.applicableStudents)) {
        p.applicableStudents = p.applicableStudents.map(id => {
          const sid = String(id).trim();
          return studentMap.get(sid) || { _id: sid, name: `Student ID: ${sid}`, studentId: sid };
        });
      }
    });

    return isArray ? productsList : productsList[0];
  } catch (err) {
    console.error('[MySQL Search] Student name resolution failed:', err);
    return products; // Return original if resolution fails
  }
};

const sanitizeSetItems = async (setItems) => {
  if (!Array.isArray(setItems) || setItems.length === 0) return [];

  const normalizedItems = setItems
    .map((item) => {
      const productId = item?.productId || item?.product || item?._id;
      if (!productId) return null;
      const quantityRaw = Number(item?.quantity);
      const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.round(quantityRaw) : 1;
      return { productId, quantity };
    })
    .filter(Boolean);

  if (normalizedItems.length === 0) return [];

  const productIds = [...new Set(normalizedItems.map((item) => String(item.productId)))];

  const existingProducts = await Product.find({
    _id: { $in: productIds },
    $or: [{ isSet: { $exists: false } }, { isSet: false }],
  }).select('name price');

  const existingMap = new Map(existingProducts.map((prod) => [String(prod._id), prod]));

  return normalizedItems
    .map((item) => {
      const match = existingMap.get(String(item.productId));
      if (!match) return null;
      return {
        product: match._id,
        quantity: item.quantity,
        productNameSnapshot: match.name,
        productPriceSnapshot: match.price,
      };
    })
    .filter(Boolean);
};

const normalizeSetItemsForComparison = (setItems = []) =>
  (Array.isArray(setItems) ? setItems : [])
    .map((item) => ({
      productId: String(item?.product?._id || item?.product || item?.productId || ''),
      quantity: Number(item?.quantity) || 0,
    }))
    .filter((item) => item.productId && item.quantity > 0)
    .sort((a, b) => {
      if (a.productId === b.productId) return a.quantity - b.quantity;
      return a.productId.localeCompare(b.productId);
    });

const haveSetItemsChanged = (oldSetItems = [], newSetItems = []) => {
  const normalizedOld = normalizeSetItemsForComparison(oldSetItems);
  const normalizedNew = normalizeSetItemsForComparison(newSetItems);
  if (normalizedOld.length !== normalizedNew.length) return true;

  return normalizedOld.some((item, index) => {
    const other = normalizedNew[index];
    return item.productId !== other.productId || item.quantity !== other.quantity;
  });
};

const accumulateCollegeStockDelta = (deltaMap, productId, delta) => {
  if (!productId || !Number.isFinite(delta) || delta === 0) return;
  const key = String(productId);
  deltaMap.set(key, (deltaMap.get(key) || 0) + delta);
};

const applyCollegeStockChanges = async (collegeId, deltaMap) => {
  if (!collegeId || !deltaMap || deltaMap.size === 0) return;

  const college = await College.findById(collegeId);
  if (!college) return;

  const stockMap = new Map();
  (college.stock || []).forEach((entry) => {
    stockMap.set(String(entry.product), Number(entry.quantity) || 0);
  });

  deltaMap.forEach((delta, productId) => {
    stockMap.set(productId, (stockMap.get(productId) || 0) + delta);
  });

  college.stock = Array.from(stockMap.entries()).map(([product, quantity]) => ({
    product,
    quantity,
  }));
  await college.save();
};

const buildUpdatedSetComponents = (itemQuantity, nextSetItems, previousComponents = []) => {
  const previousById = new Map();
  (Array.isArray(previousComponents) ? previousComponents : []).forEach((component) => {
    const productId = String(component?.productId?._id || component?.productId || '');
    if (productId) previousById.set(productId, component);
  });

  return (Array.isArray(nextSetItems) ? nextSetItems : []).map((setItem) => {
    const productId = String(setItem.product);
    const previous = previousById.get(productId);
    const taken = previous
      ? previous.taken !== false
      : true;

    return {
      productId: setItem.product,
      name: setItem.productNameSnapshot || previous?.name || '',
      quantity: (Number(itemQuantity) || 0) * (Number(setItem.quantity) || 1),
      taken,
      stockReserved: previous
        ? (Object.prototype.hasOwnProperty.call(previous, 'stockReserved')
          ? Boolean(previous.stockReserved)
          : true)
        : Boolean(taken),
      reason: taken ? undefined : (previous?.reason || 'Marked as not taken'),
    };
  });
};

/**
 * Pair removed kit components with newly added ones (old product → new product).
 * Used by customized sync flow.
 */
const buildComponentReplacementMap = (previousSetItems = [], nextSetItems = []) => {
  const prevIds = normalizeSetItemsForComparison(previousSetItems).map((i) => i.productId);
  const nextIds = normalizeSetItemsForComparison(nextSetItems).map((i) => i.productId);
  const prevSet = new Set(prevIds);
  const nextSet = new Set(nextIds);

  const removed = prevIds.filter((id) => !nextSet.has(id));
  const added = nextIds.filter((id) => !prevSet.has(id));

  const replacementMap = new Map(); // oldProductId -> newProductId
  const reverseMap = new Map(); // newProductId -> oldProductId
  const pairCount = Math.min(removed.length, added.length);

  for (let i = 0; i < pairCount; i += 1) {
    replacementMap.set(removed[i], added[i]);
    reverseMap.set(added[i], removed[i]);
  }

  return {
    removed,
    added,
    replacementMap,
    reverseMap,
    hasReplacements: pairCount > 0,
  };
};

const wasComponentStockReserved = (component) => {
  if (!component) return false;
  if (
    Object.prototype.hasOwnProperty.call(component, 'stockReserved') &&
    component.stockReserved !== undefined &&
    component.stockReserved !== null
  ) {
    return Boolean(component.stockReserved);
  }
  // Legacy: paid issue deducted even when taken=false
  return true;
};

/**
 * Customized flow: old product → new product for ONE kit item.
 * - Unchanged components keep taken/stockReserved as-is
 * - For replaced component:
 *    1) restore old stock if it was reserved
 *    2) ALWAYS deduct new stock (negative allowed)
 *    3) if new stock was insufficient → taken=false + stockReserved=true
 *       (shows in Zero Stock Dues; Mark as Taken will NOT deduct again)
 *    4) if sufficient → keep previous taken status, stockReserved=true when deducted
 */
const buildAndReconcileCustomReplacement = ({
  itemQuantity,
  nextSetItems,
  previousComponents = [],
  replacementMap = new Map(),
  collegeDelta = null,
  collegeBaseStock = null,
}) => {
  const previousById = new Map();
  (Array.isArray(previousComponents) ? previousComponents : []).forEach((component) => {
    const productId = String(component?.productId?._id || component?.productId || '');
    if (productId) previousById.set(productId, component);
  });

  const reverseMap = new Map();
  replacementMap.forEach((newId, oldId) => reverseMap.set(String(newId), String(oldId)));

  const getProjected = (productId) => {
    const base = collegeBaseStock ? Number(collegeBaseStock.get(String(productId)) || 0) : 0;
    const pending = collegeDelta ? Number(collegeDelta.get(String(productId)) || 0) : 0;
    return base + pending;
  };

  let replacedDelivered = 0;
  let replacedWaiting = 0;

  const nextComponents = (Array.isArray(nextSetItems) ? nextSetItems : []).map((setItem) => {
    const productId = String(setItem.product);
    const replacedFromId = reverseMap.get(productId);
    const previousSame = previousById.get(productId);
    const previousReplaced = replacedFromId ? previousById.get(replacedFromId) : null;
    const qty = (Number(itemQuantity) || 0) * (Number(setItem.quantity) || 1);

    // Unchanged component
    if (previousSame && !replacedFromId) {
      const taken = previousSame.taken !== false;
      return {
        productId: setItem.product,
        name: setItem.productNameSnapshot || previousSame.name || '',
        quantity: qty,
        taken,
        stockReserved: wasComponentStockReserved(previousSame),
        reason: taken ? undefined : (previousSame.reason || 'Marked as not taken'),
      };
    }

    // Replaced component
    const previous = previousReplaced || previousSame;
    const previousTaken = previous ? previous.taken !== false : true;
    const oldReserved = previous ? wasComponentStockReserved(previous) : false;
    const oldQty = previous ? Number(previous.quantity) || 0 : 0;

    // 1) Restore old product reservation
    if (collegeDelta && replacedFromId && oldReserved && oldQty > 0) {
      accumulateCollegeStockDelta(collegeDelta, replacedFromId, oldQty);
    }

    // 2) Always deduct new product (allow negative)
    const availableBefore = getProjected(productId);
    if (collegeDelta && qty > 0) {
      accumulateCollegeStockDelta(collegeDelta, productId, -qty);
    }

    // 3) Insufficient new stock → not taken, but already reserved (no double deduct later)
    let taken = previousTaken;
    let stockReserved = true;
    let reason;

    if (availableBefore < qty) {
      taken = false;
      stockReserved = true;
      reason = `Insufficient stock at college for replacement (required ${qty}, available ${Math.max(availableBefore, 0)}). Waiting in Zero Stock Dues.`;
      replacedWaiting += 1;
    } else if (previousTaken) {
      taken = true;
      stockReserved = true;
      replacedDelivered += 1;
    } else {
      // Was already waiting; stock deducted for new product, still waiting for handover
      taken = false;
      stockReserved = true;
      reason =
        previous?.reason ||
        `Waiting for stock / handover of replaced component`;
      replacedWaiting += 1;
    }

    return {
      productId: setItem.product,
      name: setItem.productNameSnapshot || previous?.name || '',
      quantity: qty,
      taken,
      stockReserved,
      reason: taken ? undefined : reason,
    };
  });

  // Pure removals with no replacement target: restore old reserved stock
  if (collegeDelta) {
    const nextIds = new Set(
      (Array.isArray(nextSetItems) ? nextSetItems : []).map((s) => String(s.product))
    );
    previousById.forEach((previous, oldId) => {
      if (nextIds.has(oldId)) return;
      if (replacementMap.has(oldId)) return; // already handled via restore above
      if (!wasComponentStockReserved(previous)) return;
      accumulateCollegeStockDelta(collegeDelta, oldId, Number(previous.quantity) || 0);
    });
  }

  return { nextComponents, replacedDelivered, replacedWaiting };
};

const reconcileSetComponentStock = (deltaMap, previousComponents = [], nextComponents = []) => {
  const previousById = new Map();
  const nextById = new Map();

  (Array.isArray(previousComponents) ? previousComponents : []).forEach((component) => {
    const productId = String(component?.productId?._id || component?.productId || '');
    if (productId) previousById.set(productId, component);
  });

  (Array.isArray(nextComponents) ? nextComponents : []).forEach((component) => {
    const productId = String(component?.productId?._id || component?.productId || '');
    if (productId) nextById.set(productId, component);
  });

  const allProductIds = new Set([...previousById.keys(), ...nextById.keys()]);
  allProductIds.forEach((productId) => {
    const previous = previousById.get(productId);
    const next = nextById.get(productId);
    const previousReserved = previous && previous.taken !== false ? Number(previous.quantity) || 0 : 0;
    const nextReserved = next && next.taken !== false ? Number(next.quantity) || 0 : 0;
    accumulateCollegeStockDelta(deltaMap, productId, previousReserved - nextReserved);
  });
};

const buildIssuedSetImpactPreview = async ({
  productId,
  nextSetItems,
  previousSetItems = [],
  syncMode = 'normal',
}) => {
  const transactions = await Transaction.find({
    transactionType: { $in: ['student', 'employee'] },
    'items.productId': productId,
    'items.isSet': true,
  }).lean();

  const replacementInfo = buildComponentReplacementMap(previousSetItems, nextSetItems);
  const isCustom = syncMode === 'custom';

  if (transactions.length === 0) {
    return {
      affectedExistingTransactions: true,
      syncMode: isCustom ? 'custom' : 'normal',
      transactionsUpdated: 0,
      totalAffectedKitQuantity: 0,
      collegeStocksAdjusted: 0,
      colleges: [],
      deliveredCount: 0,
      waitingCount: 0,
      replacements: Array.from(replacementInfo.replacementMap.entries()).map(([from, to]) => ({
        fromProductId: from,
        toProductId: to,
      })),
    };
  }

  // Preload college stock maps for custom projected availability checks
  const collegeIdsNeeded = new Set();
  transactions.forEach((txn) => {
    const cid = txn.collegeId || txn.branchId;
    if (cid) collegeIdsNeeded.add(String(cid));
  });
  const collegeDocs = collegeIdsNeeded.size > 0
    ? await College.find({ _id: { $in: Array.from(collegeIdsNeeded) } }).select('name stock').lean()
    : [];
  const collegeBaseStockById = new Map();
  const collegeById = new Map();
  collegeDocs.forEach((college) => {
    const key = String(college._id);
    collegeById.set(key, college);
    const stockMap = new Map();
    (college.stock || []).forEach((entry) => {
      stockMap.set(String(entry.product), Number(entry.quantity) || 0);
    });
    collegeBaseStockById.set(key, stockMap);
  });

  const stockChangesByCollege = new Map();
  let transactionsUpdated = 0;
  let totalAffectedKitQuantity = 0;
  let deliveredCount = 0;
  let waitingCount = 0;

  for (const transaction of transactions) {
    let touched = false;
    const collegeId = transaction.collegeId || transaction.branchId;
    const collegeKey = collegeId ? String(collegeId) : '';
    let collegeDelta = null;

    for (const item of transaction.items || []) {
      if (String(item.productId) !== String(productId) || !item.isSet) continue;

      totalAffectedKitQuantity += Number(item.quantity) || 0;
      touched = true;

      const previousComponents = Array.isArray(item.setComponents) ? item.setComponents : [];
      let nextComponents;

      if (isCustom) {
        if (transaction.isPaid && transaction.stockDeducted && collegeKey) {
          if (!stockChangesByCollege.has(collegeKey)) {
            stockChangesByCollege.set(collegeKey, new Map());
          }
          collegeDelta = stockChangesByCollege.get(collegeKey);
        }

        const result = buildAndReconcileCustomReplacement({
          itemQuantity: item.quantity,
          nextSetItems,
          previousComponents,
          replacementMap: replacementInfo.replacementMap,
          collegeDelta: collegeDelta,
          collegeBaseStock: collegeKey ? collegeBaseStockById.get(collegeKey) : null,
        });
        nextComponents = result.nextComponents;
        deliveredCount += result.replacedDelivered;
        waitingCount += result.replacedWaiting;
      } else {
        nextComponents = buildUpdatedSetComponents(item.quantity, nextSetItems, previousComponents);

        if (transaction.isPaid && transaction.stockDeducted && collegeKey) {
          if (!stockChangesByCollege.has(collegeKey)) {
            stockChangesByCollege.set(collegeKey, new Map());
          }
          collegeDelta = stockChangesByCollege.get(collegeKey);
          reconcileSetComponentStock(collegeDelta, previousComponents, nextComponents);
        }
      }
    }

    if (touched) transactionsUpdated += 1;
  }

  const affectedProductIds = new Set();
  stockChangesByCollege.forEach((deltaMap) => {
    deltaMap.forEach((_, pid) => affectedProductIds.add(pid));
  });
  const products = affectedProductIds.size > 0
    ? await Product.find({ _id: { $in: Array.from(affectedProductIds) } }).select('name').lean()
    : [];
  const productNameById = new Map(products.map((product) => [String(product._id), product.name]));

  // Also resolve replacement names for UI
  const replacementIds = new Set();
  replacementInfo.replacementMap.forEach((to, from) => {
    replacementIds.add(from);
    replacementIds.add(to);
  });
  const missingReplacementIds = Array.from(replacementIds).filter((id) => !productNameById.has(id));
  if (missingReplacementIds.length > 0) {
    const extra = await Product.find({ _id: { $in: missingReplacementIds } }).select('name').lean();
    extra.forEach((p) => productNameById.set(String(p._id), p.name));
  }

  const collegeSummaries = [];
  let collegeStocksAdjusted = 0;

  for (const [collegeId, deltaMap] of stockChangesByCollege.entries()) {
    if (deltaMap.size === 0) continue;
    collegeStocksAdjusted += 1;

    const college = collegeById.get(collegeId);
    const currentStockMap = collegeBaseStockById.get(collegeId) || new Map();

    const items = Array.from(deltaMap.entries())
      .filter(([, delta]) => delta !== 0)
      .map(([pid, delta]) => {
        const currentStock = currentStockMap.get(pid) || 0;
        return {
          productId: pid,
          productName: productNameById.get(pid) || 'Unknown Product',
          delta,
          currentStock,
          projectedStock: currentStock + delta,
        };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    collegeSummaries.push({
      collegeId,
      collegeName: college?.name || 'Unknown College',
      items,
    });
  }

  return {
    affectedExistingTransactions: true,
    syncMode: isCustom ? 'custom' : 'normal',
    transactionsUpdated,
    totalAffectedKitQuantity,
    collegeStocksAdjusted,
    colleges: collegeSummaries,
    deliveredCount,
    waitingCount,
    replacements: Array.from(replacementInfo.replacementMap.entries()).map(([from, to]) => ({
      fromProductId: from,
      fromProductName: productNameById.get(from) || from,
      toProductId: to,
      toProductName: productNameById.get(to) || to,
    })),
  };
};

const syncIssuedSetTransactions = async ({
  productId,
  nextSetItems,
  previousSetItems = [],
  syncMode = 'normal',
}) => {
  // Dry-run first so the returned summary matches what we apply (do not re-preview after mutate).
  const preview = await buildIssuedSetImpactPreview({
    productId,
    nextSetItems,
    previousSetItems,
    syncMode,
  });

  const isCustom = syncMode === 'custom';
  const replacementInfo = buildComponentReplacementMap(previousSetItems, nextSetItems);

  const transactions = await Transaction.find({
    transactionType: { $in: ['student', 'employee'] },
    'items.productId': productId,
    'items.isSet': true,
  });

  const collegeIdsNeeded = new Set();
  transactions.forEach((txn) => {
    const cid = txn.collegeId || txn.branchId;
    if (cid) collegeIdsNeeded.add(String(cid));
  });
  const collegeDocs = collegeIdsNeeded.size > 0
    ? await College.find({ _id: { $in: Array.from(collegeIdsNeeded) } }).select('stock').lean()
    : [];
  const collegeBaseStockById = new Map();
  collegeDocs.forEach((college) => {
    const stockMap = new Map();
    (college.stock || []).forEach((entry) => {
      stockMap.set(String(entry.product), Number(entry.quantity) || 0);
    });
    collegeBaseStockById.set(String(college._id), stockMap);
  });

  const stockChangesByCollege = new Map();

  for (const transaction of transactions) {
    let touched = false;
    const collegeId = transaction.collegeId || transaction.branchId;
    const collegeKey = collegeId ? String(collegeId) : '';
    let collegeDelta = null;

    for (const item of transaction.items || []) {
      if (String(item.productId) !== String(productId) || !item.isSet) continue;

      const previousComponents = Array.isArray(item.setComponents) ? item.setComponents : [];
      let nextComponents;

      if (isCustom) {
        if (transaction.isPaid && transaction.stockDeducted && collegeKey) {
          if (!stockChangesByCollege.has(collegeKey)) {
            stockChangesByCollege.set(collegeKey, new Map());
          }
          collegeDelta = stockChangesByCollege.get(collegeKey);
        }

        const result = buildAndReconcileCustomReplacement({
          itemQuantity: item.quantity,
          nextSetItems,
          previousComponents,
          replacementMap: replacementInfo.replacementMap,
          collegeDelta,
          collegeBaseStock: collegeKey ? collegeBaseStockById.get(collegeKey) : null,
        });
        nextComponents = result.nextComponents;
      } else {
        nextComponents = buildUpdatedSetComponents(item.quantity, nextSetItems, previousComponents);

        if (transaction.isPaid && transaction.stockDeducted && collegeKey) {
          if (!stockChangesByCollege.has(collegeKey)) {
            stockChangesByCollege.set(collegeKey, new Map());
          }
          collegeDelta = stockChangesByCollege.get(collegeKey);
          reconcileSetComponentStock(collegeDelta, previousComponents, nextComponents);
        }
      }

      item.setComponents = nextComponents;
      item.status = nextComponents.some((component) => component.taken === false) ? 'partial' : 'fulfilled';
      touched = true;
    }

    if (touched) {
      transaction.markModified('items');
      await transaction.save();
    }
  }

  for (const [collegeId, deltaMap] of stockChangesByCollege.entries()) {
    if (deltaMap.size === 0) continue;
    await applyCollegeStockChanges(collegeId, deltaMap);
  }

  return preview;
};

const previewProductImpact = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const nextSetItems = await sanitizeSetItems(req.body?.setItems);
    const syncMode = req.body?.existingSyncMode === 'custom' ? 'custom' : 'normal';
    const compositionChanged =
      Boolean(product.isSet) &&
      haveSetItemsChanged(product.setItems || [], nextSetItems);

    if (!product.isSet || !compositionChanged) {
      return res.status(200).json({
        compositionChanged: false,
        affectedExistingTransactions: false,
        syncMode,
        transactionsUpdated: 0,
        totalAffectedKitQuantity: 0,
        collegeStocksAdjusted: 0,
        colleges: [],
        deliveredCount: 0,
        waitingCount: 0,
        replacements: [],
      });
    }

    const preview = await buildIssuedSetImpactPreview({
      productId: product._id,
      nextSetItems,
      previousSetItems: product.setItems || [],
      syncMode,
    });

    res.status(200).json({
      compositionChanged: true,
      ...preview,
    });
  } catch (error) {
    console.error('Preview Product Impact Error:', error);
    res.status(400).json({ message: 'Error previewing product impact', error: error.message });
  }
};

/**
 * @desc    Create a new product
 * @route   POST /api/products
 * @access  Public
 */
const createProduct = async (req, res) => {
  try {

    console.log('POST /api/products body:', req.body);
    // Diagnostic: print the year schema options to ensure the loaded schema allows year=0
    try {
      console.log('Product.year schema options:', Product.schema.path('year') && Product.schema.path('year').options);
    } catch (diagErr) {
      console.warn('Could not read Product schema year options:', diagErr);
    }
    const { name, description, price, stock, imageUrl, forCourse, forCourseId, branch, branchIds, years, year, academicYears, remarks, isSet, setItems, lowStockThreshold, semesters, collegeId, applicabilityMode, applicableStudents } = req.body;
    // Handle years array - if years is provided, use it; otherwise fallback to year for backward compatibility
    let parsedYears = [];
    if (years && Array.isArray(years)) {
      parsedYears = years.map(y => Number(y)).filter(y => !isNaN(y) && y >= 0 && y <= 10);
    } else if (year !== undefined && year !== null && year !== '') {
      const parsedYear = Number(year);
      if (!isNaN(parsedYear) && parsedYear >= 0 && parsedYear <= 10) {
        parsedYears = parsedYear === 0 ? [] : [parsedYear]; // 0 means all years (empty array)
      }
    }

    // Handle branch array - if branch is provided as array, use it; otherwise handle string for backward compatibility
    let parsedBranches = [];
    if (branch !== undefined && branch !== null) {
      if (Array.isArray(branch)) {
        parsedBranches = branch.filter(b => typeof b === 'string' && b.trim().length > 0).map(b => b.trim());
      } else if (typeof branch === 'string' && branch.trim().length > 0) {
        parsedBranches = [branch.trim()]; // Convert single string to array for backward compatibility
      }
    }

    // sanitize numeric fields
    const parsedPrice = price !== undefined && price !== null && price !== '' ? Number(price) : 0;
    let parsedStock = stock !== undefined && stock !== null && stock !== '' ? Number(stock) : 0;

    const sanitizedSetItems = isSet ? await sanitizeSetItems(setItems) : [];
    if (isSet && sanitizedSetItems.length === 0) {
      return res.status(400).json({ message: 'Set products must include at least one existing item' });
    }
    if (isSet) {
      parsedStock = parsedStock < 0 ? 0 : parsedStock;
    }

    const thresholdNumber = lowStockThreshold !== undefined && lowStockThreshold !== null && lowStockThreshold !== ''
      ? Math.max(0, Number(lowStockThreshold) || 0)
      : undefined;

    const product = new Product({
      name,
      description: description || '', // Description is optional, can be added later
      price: parsedPrice,
      category: 'Other', // Default category since we're removing it from form
      stock: parsedStock,
      imageUrl,
      forCourse: forCourse || '',
      forCourseId: forCourseId !== undefined && forCourseId !== '' ? Number(forCourseId) : null,
      branch: parsedBranches,
      branchIds: Array.isArray(branchIds) ? branchIds.map(Number).filter(id => !isNaN(id)) : [],
      years: parsedYears,
      year: parsedYears.length === 1 ? parsedYears[0] : (parsedYears.length === 0 ? 0 : parsedYears[0]), // Backward compatibility
      academicYears: Array.isArray(academicYears)
        ? academicYears.map((y) => String(y).trim()).filter(Boolean)
        : [],
      remarks: remarks || '',
      lastPriceUpdated: new Date(), // Set initial price update date
      isSet: Boolean(isSet),
      setItems: sanitizedSetItems,
      lowStockThreshold: Boolean(isSet) ? 0 : thresholdNumber,
      semesters: (semesters || []).map(Number).filter(s => s === 1 || s === 2),
      stock: collegeId ? 0 : parsedStock, // If collegeId, central stock is 0
      applicabilityMode: applicabilityMode || 'rules',
      applicableStudents: Array.isArray(applicableStudents) ? applicableStudents : [],
    });

    const createdProduct = await product.save();

    // If collegeId is provided and there's initial stock, add it to the college
    if (collegeId && parsedStock > 0) {
      const college = await College.findById(collegeId);
      if (college) {
        if (!college.stock) college.stock = [];
        college.stock.push({ product: createdProduct._id, quantity: parsedStock });
        await college.save();
        console.log(`Initialized stock for product ${name} in college ${college.name} with ${parsedStock}`);
      }
    }
    await createdProduct.populate({ path: 'setItems.product', select: 'name price isSet' });
    console.log('Created product id:', createdProduct._id);
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Error in createProduct:', error.stack || error.message || error);
    res.status(400).json({ message: 'Error creating product', error: error.message });
  }
};

/**
 * @desc    Get all products
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = async (req, res) => {
  try {
    const filter = {};
    // optional query param: ?course=b.tech to fetch products only for that course
    if (req.query.course) filter.forCourse = req.query.course;
    if (req.query.year) {
      const py = Number(req.query.year);
      if (!isNaN(py)) {
        // Support both year field and years array
        filter.$or = [
          { year: py },
          { years: py }
        ];
      }
    }
    const products = await Product.find(filter).populate({ path: 'setItems.product', select: 'name price isSet' }).lean();
    const resolvedProducts = await resolveStudentNamesForProducts(products);
    res.status(200).json(resolvedProducts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};

/**
 * @desc    Get a single product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate({ path: 'setItems.product', select: 'name price isSet' }).lean();

    if (product) {
      const resolvedProduct = await resolveStudentNamesForProducts(product);
      res.status(200).json(resolvedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product', error: error.message });
  }
};

/**
 * @desc    Update a product
 * @route   PUT /api/products/:id
 * @access  Public
 */
const updateProduct = async (req, res) => {
  try {
    console.log(`PUT /api/products/${req.params.id} body:`, req.body);
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Track old name for updating transactions if name changes
    const oldName = product.name;

    const { name, description, price, stock, imageUrl, forCourse, forCourseId, branch, branchIds, years, year, academicYears, remarks, isSet, setItems, lowStockThreshold, semesters, applicabilityMode, applicableStudents, affectExistingTransactions, existingSyncMode } = req.body;
    // Handle years array - if years is provided, use it; otherwise fallback to year for backward compatibility
    let parsedYears = undefined;
    if (years !== undefined && Array.isArray(years)) {
      parsedYears = years.map(y => Number(y)).filter(y => !isNaN(y) && y >= 0 && y <= 10);
    } else if (year !== undefined && year !== null && year !== '') {
      const parsedYear = Number(year);
      if (!isNaN(parsedYear) && parsedYear >= 0 && parsedYear <= 10) {
        parsedYears = parsedYear === 0 ? [] : [parsedYear];
      }
    }

    // Handle branch array - if branch is provided as array, use it; otherwise handle string for backward compatibility
    let parsedBranches = undefined;
    if (branch !== undefined && branch !== null) {
      if (Array.isArray(branch)) {
        parsedBranches = branch.filter(b => typeof b === 'string' && b.trim().length > 0).map(b => b.trim());
      } else if (typeof branch === 'string' && branch.trim().length > 0) {
        parsedBranches = [branch.trim()]; // Convert single string to array for backward compatibility
      } else {
        parsedBranches = []; // Empty array if branch is empty string or null
      }
    }

    // Track price change before updating
    const oldPrice = product.price;
    let newPrice = product.price;
    if (price !== undefined && price !== null && price !== '') {
      const parsed = Number(price);
      newPrice = !isNaN(parsed) ? parsed : product.price;
    }

    // If price is being changed, add old price to history and update timestamp
    if (price !== undefined && price !== null && price !== '' && newPrice !== oldPrice) {
      // Initialize price history if it doesn't exist
      if (!product.priceHistory || !Array.isArray(product.priceHistory)) {
        product.priceHistory = [];
      }
      // Add old price to history before updating to new price
      product.priceHistory.push({
        price: oldPrice,
        updatedAt: new Date(),
        updatedBy: 'System',
      });
      // Update timestamp for price change
      product.lastPriceUpdated = new Date();
    }

    product.name = name ?? product.name;
    product.description = description ?? product.description;
    product.price = newPrice;
    // If collegeId is provided, we update college stock instead of global stock
    const { collegeId } = req.body;
    if (collegeId) {
      const college = await College.findById(collegeId);
      if (college) {
        if (!college.stock) college.stock = [];

        const stockIndex = college.stock.findIndex(item => item.product.toString() === product._id.toString());

        let newQuantity = 0;
        if (stock !== undefined && stock !== null) {
          const parsed = Number(stock);
          newQuantity = (!isNaN(parsed) && parsed >= 0) ? parsed : 0;
        }

        if (stockIndex !== -1) {
          college.stock[stockIndex].quantity = newQuantity;
        } else {
          college.stock.push({ product: product._id, quantity: newQuantity });
        }

        await college.save();
        console.log(`Updated stock for product ${product.name} in college ${college.name} to ${newQuantity}`);
      }
    } else {
      // Only update product.stock if NOT updating a specific college
      if (stock !== undefined && stock !== null) {
        const parsedStock = Number(stock);
        product.stock = (stock === '' || isNaN(parsedStock)) ? 0 : parsedStock;
      }
    }
    product.imageUrl = imageUrl ?? product.imageUrl;
    product.forCourse = forCourse ?? product.forCourse;
    if (forCourseId !== undefined) {
      product.forCourseId = forCourseId !== '' ? Number(forCourseId) : null;
    }
    if (parsedBranches !== undefined) {
      product.branch = parsedBranches;
    }
    if (branchIds !== undefined) {
      product.branchIds = Array.isArray(branchIds) ? branchIds.map(Number).filter(id => !isNaN(id)) : [];
    }
    if (parsedYears !== undefined) {
      product.years = parsedYears;
      product.year = parsedYears.length === 1 ? parsedYears[0] : (parsedYears.length === 0 ? 0 : parsedYears[0]); // Backward compatibility
    }
    if (semesters !== undefined) {
      product.semesters = Array.isArray(semesters) ? semesters.map(Number).filter(s => s === 1 || s === 2) : [];
    }
    if (academicYears !== undefined) {
      product.academicYears = Array.isArray(academicYears)
        ? academicYears.map((y) => String(y).trim()).filter(Boolean)
        : [];
    }
    product.remarks = remarks !== undefined ? remarks : product.remarks;

    // Robust parsing for isSet to handle string "false" from FormData or loose typing
    let isSetFlag = product.isSet;
    if (isSet !== undefined) {
      if (typeof isSet === 'string') {
        isSetFlag = (isSet.toLowerCase() === 'true');
      } else {
        isSetFlag = Boolean(isSet);
      }
    }
    const previousIsSet = Boolean(product.isSet);
    const previousSetItems = Array.isArray(product.setItems)
      ? product.setItems.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        productNameSnapshot: item.productNameSnapshot,
        productPriceSnapshot: item.productPriceSnapshot,
      }))
      : [];

    let sanitizedSetItems = product.setItems;

    if (isSetFlag) {
      const incomingSetItems = setItems !== undefined ? setItems : product.setItems;
      sanitizedSetItems = await sanitizeSetItems(incomingSetItems);
      if (sanitizedSetItems.length === 0) {
        return res.status(400).json({ message: 'Set products must include at least one existing item' });
      }
    }

    product.isSet = isSetFlag;
    if (product.isSet) {
      product.setItems = sanitizedSetItems;
      if (product.stock < 0) {
        product.stock = 0;
      }
      product.lowStockThreshold = 0;
    } else if (isSet !== undefined && !product.isSet) {
      product.setItems = [];
    }

    if (!product.isSet && lowStockThreshold !== undefined) {
      const thresholdNumber = Math.max(0, Number(lowStockThreshold) || 0);
      product.lowStockThreshold = thresholdNumber;
    }

    if (applicabilityMode !== undefined) {
      product.applicabilityMode = applicabilityMode;
    }
    if (applicableStudents !== undefined && Array.isArray(applicableStudents)) {
      product.applicableStudents = applicableStudents;
    }

    const setCompositionChanged = previousIsSet && isSetFlag && haveSetItemsChanged(previousSetItems, sanitizedSetItems);

    const updated = await product.save();
    await updated.populate({ path: 'setItems.product', select: 'name price isSet' });

    let syncSummary = null;
    if (setCompositionChanged && affectExistingTransactions === true) {
      const syncMode = existingSyncMode === 'custom' ? 'custom' : 'normal';
      syncSummary = await syncIssuedSetTransactions({
        productId: updated._id,
        nextSetItems: sanitizedSetItems,
        previousSetItems,
        syncMode,
      });
    } else if (setCompositionChanged) {
      syncSummary = {
        affectedExistingTransactions: false,
        transactionsUpdated: 0,
        collegeStocksAdjusted: 0,
      };
    }

    // If the product name changed, update it in all related records
    const newName = updated.name;
    if (oldName !== newName) {
      try {
        // Update product name in transaction items
        await Transaction.updateMany(
          { 'items.productId': updated._id },
          { $set: { 'items.$[item].name': newName } },
          { arrayFilters: [{ 'item.productId': updated._id }] }
        );

        // Update product name in setComponents (when this product is part of a set)
        await Transaction.updateMany(
          { 'items.setComponents.productId': updated._id },
          { $set: { 'items.$[].setComponents.$[comp].name': newName } },
          { arrayFilters: [{ 'comp.productId': updated._id }] }
        );

        // Also update productNameSnapshot in other products' setItems that reference this product
        await Product.updateMany(
          { 'setItems.product': updated._id },
          { $set: { 'setItems.$[item].productNameSnapshot': newName } },
          { arrayFilters: [{ 'item.product': updated._id }] }
        );

        // Update the items key in all transactions who have this product
        // REMOVED: Student items are now calculated dynamically. We do not need to update MongoDB User docs.

        console.log(`Product name updated from "${oldName}" to "${newName}" in all transactions and sets`);
      } catch (syncError) {
        console.error('Failed to sync product name to related records:', syncError);
      }
    }

    const responsePayload = updated.toObject ? updated.toObject() : updated;
    if (syncSummary) {
      responsePayload.syncSummary = syncSummary;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(400).json({ message: 'Error updating product', error: error.message });
  }
};

/**
 * @desc    Delete a product
 * @route   DELETE /api/products/:id
 * @access  Public
 */
const deleteProduct = async (req, res) => {
  try {
    console.log('DELETE /api/products called with id:', req.params.id);
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    console.log('Product deleted from products collection:', product._id);

    // Also remove this product key from any user's items map (if present)
    // REMOVED: Student items are now calculated dynamically.

    res.json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
};

module.exports = { createProduct, getProducts, getProductById, previewProductImpact, updateProduct, deleteProduct };