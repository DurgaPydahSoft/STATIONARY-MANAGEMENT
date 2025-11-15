const { Transaction } = require('../models/transactionModel');
const { User } = require('../models/userModel');
const { Product } = require('../models/productModel');
const asyncHandler = require('express-async-handler');

// Helpers for stock management (supports set products)
const accumulateStockChange = (changeMap, productId, delta) => {
  if (!productId || !Number.isFinite(delta)) return;
  const key = productId.toString();
  const currentDelta = changeMap.get(key) || 0;
  changeMap.set(key, currentDelta + delta);
};

const getProjectedStock = (productId, stockMap, changeMap) => {
  const key = productId.toString();
  const baseStock = stockMap.has(key) ? stockMap.get(key) : 0;
  const pending = changeMap.has(key) ? changeMap.get(key) : 0;
  return baseStock + pending;
};

const applyStockChanges = async (changeMap) => {
  if (!changeMap || changeMap.size === 0) return;

  const bulkOps = [];
  changeMap.forEach((delta, productId) => {
    if (!delta) return;
    bulkOps.push({
      updateOne: {
        filter: { _id: productId },
        update: { $inc: { stock: delta } },
      },
    });
  });

  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps, { ordered: false });
  }
};

const loadProductsWithComponents = async (productIds) => {
  const ids = Array.from(productIds || [])
    .filter(Boolean)
    .map((id) => id.toString());

  if (ids.length === 0) {
    return {
      productMap: new Map(),
      stockMap: new Map(),
    };
  }

  const products = await Product.find({ _id: { $in: ids } }).populate({
    path: 'setItems.product',
    select: 'name stock price isSet setItems',
  });

  const productMap = new Map();
  const stockMap = new Map();

  products.forEach((prod) => {
    const prodId = prod._id.toString();
    productMap.set(prodId, prod);
    stockMap.set(prodId, prod.stock ?? 0);

    if (prod.isSet && Array.isArray(prod.setItems)) {
      prod.setItems.forEach((setItem) => {
        const component = setItem?.product;
        if (!component) return;
        const componentId = component._id.toString();
        stockMap.set(componentId, component.stock ?? 0);
        if (!productMap.has(componentId)) {
          productMap.set(componentId, component);
        }
      });
    }
  });

  if (productMap.size < ids.length) {
    const missing = ids.filter((id) => !productMap.has(id));
    throw new Error(`Product not found: ${missing.join(', ')}`);
  }

  return { productMap, stockMap };
};

/**
 * @desc    Create a new transaction
 * @route   POST /api/transactions
 * @access  Public
 */
const createTransaction = asyncHandler(async (req, res) => {
  const { studentId, items, paymentMethod, isPaid, remarks } = req.body;

  if (!studentId || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Student ID and items are required');
  }

  // Find the student
  const student = await User.findById(studentId);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const requestedProductIds = new Set(items.map((item) => item.productId));
  const { productMap, stockMap } = await loadProductsWithComponents(requestedProductIds);

  // Calculate total and validate items
  let totalAmount = 0;
  const validatedItems = [];
  const stockChanges = new Map();

  for (const item of items) {
    if (!item.productId || !item.quantity || !item.price) {
      res.status(400);
      throw new Error('Each item must have productId, quantity, and price');
    }

    const productId = item.productId.toString();
    const product = productMap.get(productId);

    if (!product) {
      res.status(404);
      throw new Error(`Product not found: ${item.productId}`);
    }

    const requestedQuantity = Number(item.quantity);

    let itemStatus = 'fulfilled';
    let componentDetails = [];

    if (product.isSet) {
      if (!product.setItems || product.setItems.length === 0) {
        res.status(400);
        throw new Error(`Set ${product.name} has no component items configured.`);
      }

      for (const setItem of product.setItems) {
        const component = setItem.product;
        if (!component) {
          res.status(400);
          throw new Error(`Set ${product.name} contains an invalid item reference.`);
        }

        const componentId = component._id.toString();
        const required = requestedQuantity * (Number(setItem.quantity) || 1);
        const available = getProjectedStock(componentId, stockMap, stockChanges);

        let taken = true;
        let reason;

        if (available < required) {
          taken = false;
          itemStatus = 'partial';
          reason = `Insufficient stock at issuance (required ${required}, available ${Math.max(available, 0)})`;
        } else {
          accumulateStockChange(stockChanges, componentId, -required);
        }

        componentDetails.push({
          productId: component._id,
          name: component.name,
          quantity: required,
          taken,
          reason: taken ? undefined : reason,
        });
      }
    } else {
      if (getProjectedStock(productId, stockMap, stockChanges) < requestedQuantity) {
        res.status(400);
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${requestedQuantity}`);
      }

      accumulateStockChange(stockChanges, productId, -requestedQuantity);
    }

    const itemTotal = requestedQuantity * Number(item.price);
    totalAmount += itemTotal;
    const transactionItem = {
      productId: item.productId,
      name: item.name || product.name,
      quantity: requestedQuantity,
      price: Number(item.price),
      total: itemTotal,
      status: itemStatus,
      isSet: Boolean(product.isSet),
    };

    if (product.isSet) {
      transactionItem.setComponents = componentDetails;
    }

    validatedItems.push(transactionItem);
  }

  // Apply stock changes after validation
  await applyStockChanges(stockChanges);

  // Generate unique transaction ID
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const transactionId = `TXN-${timestamp}-${randomStr}`;

  // Create transaction
  const transaction = await Transaction.create({
    transactionId,
    transactionType: 'student', // Explicitly set for student transactions
    student: {
      userId: student._id,
      name: student.name,
      studentId: student.studentId,
      course: student.course,
      year: student.year,
      branch: student.branch || '',
    },
    items: validatedItems,
    totalAmount,
    paymentMethod: paymentMethod || 'cash',
    isPaid: isPaid || false,
    paidAt: isPaid ? new Date() : null,
    transactionDate: new Date(),
    remarks: remarks || '',
  });

  // Update student's items map based on transaction items
  const updatedItems = { ...(student.items || {}) };
  validatedItems.forEach(item => {
    const productName = item.name;
    const key = productName.toLowerCase().replace(/\s+/g, '_');
    updatedItems[key] = true;
  });

  // Update student's paid status if transaction is paid
  if (isPaid && !student.paid) {
    student.paid = true;
  }

  // Update student's items map
  student.items = updatedItems;
  await student.save();

  res.status(201).json(transaction);
});

/**
 * @desc    Get all transactions
 * @route   GET /api/transactions
 * @access  Public
 */
const getAllTransactions = asyncHandler(async (req, res) => {
  const { course, studentId, transactionType, paymentMethod, isPaid, startDate, endDate } = req.query;
  
  const filter = {};
  
  if (transactionType) {
    filter.transactionType = transactionType;
  }
  
  // Only apply student-related filters if transaction type is student or not specified
  if (!transactionType || transactionType === 'student') {
    if (course) {
      filter['student.course'] = course;
    }
    
    if (studentId) {
      const student = await User.findById(studentId);
      if (student) {
        filter['student.userId'] = student._id;
      }
    }
  }
  
  if (paymentMethod) {
    filter.paymentMethod = paymentMethod;
  }
  
  if (isPaid !== undefined && isPaid !== '') {
    filter.isPaid = isPaid === 'true';
  }

  if (startDate || endDate) {
    filter.transactionDate = {};
    if (startDate) filter.transactionDate.$gte = new Date(startDate);
    if (endDate) filter.transactionDate.$lte = new Date(endDate + 'T23:59:59');
  }

  const transactions = await Transaction.find(filter)
    .populate('items.productId', 'name price imageUrl')
    .populate('student.userId', 'name studentId course year branch')
    .populate('branchTransfer.branchId', 'name location')
    .sort({ transactionDate: -1 });

  res.status(200).json(transactions);
});

/**
 * @desc    Get transaction by ID
 * @route   GET /api/transactions/:id
 * @access  Public
 */
const getTransactionById = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id)
    .populate('items.productId', 'name price imageUrl description');

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  res.status(200).json(transaction);
});

/**
 * @desc    Update a transaction
 * @route   PUT /api/transactions/:id
 * @access  Public
 */
const updateTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  const { items, paymentMethod, isPaid, remarks } = req.body;

  // If items are being updated, recalculate total
  if (items && Array.isArray(items) && items.length > 0) {
    // First, restore stock from old transaction items
    if (transaction.items && transaction.items.length > 0) {
      const restoreIds = new Set(transaction.items.map((oldItem) => oldItem.productId));
      const { productMap: restoreProductMap } = await loadProductsWithComponents(restoreIds);
      const restoreChanges = new Map();

      for (const oldItem of transaction.items) {
        const productId = oldItem.productId.toString();
        const product = restoreProductMap.get(productId);
        if (!product) continue;

        if (
          product.isSet &&
          Array.isArray(oldItem.setComponents) &&
          oldItem.setComponents.length > 0
        ) {
          oldItem.setComponents.forEach((component) => {
            if (!component?.taken) return;
            if (!component?.productId) return;
            const qty = Number(component.quantity) || 0;
            if (qty > 0) {
              accumulateStockChange(restoreChanges, component.productId, qty);
            }
          });
        } else if (product.isSet && product.setItems?.length) {
          for (const setItem of product.setItems) {
            const component = setItem?.product;
            if (!component) continue;
            const componentId = component._id.toString();
            const restoredQty = oldItem.quantity * (Number(setItem.quantity) || 1);
            accumulateStockChange(restoreChanges, componentId, restoredQty);
          }
        } else {
          accumulateStockChange(restoreChanges, productId, oldItem.quantity);
        }
      }

      await applyStockChanges(restoreChanges);
    }

    const newProductIds = new Set(items.map((item) => item.productId));
    const { productMap: newProductMap, stockMap: newStockMap } = await loadProductsWithComponents(newProductIds);

    let totalAmount = 0;
    const validatedItems = [];
    const stockChanges = new Map();

    for (const item of items) {
      if (!item.productId || !item.quantity || !item.price) {
        res.status(400);
        throw new Error('Each item must have productId, quantity, and price');
      }

      const productId = item.productId.toString();
      const product = newProductMap.get(productId);

      if (!product) {
        res.status(404);
        throw new Error(`Product not found: ${item.productId}`);
      }

      const requestedQuantity = Number(item.quantity);

      let itemStatus = 'fulfilled';
      let componentDetails = [];

      if (product.isSet) {
        if (!product.setItems || product.setItems.length === 0) {
          res.status(400);
          throw new Error(`Set ${product.name} has no component items configured.`);
        }

        const desiredComponents = new Map();
        (Array.isArray(item.setComponents) ? item.setComponents : []).forEach((comp) => {
          if (!comp) return;
          const id =
            (comp.productId && comp.productId.toString) ? comp.productId.toString() :
            comp.productId ? String(comp.productId) :
            comp.product && comp.product._id && comp.product._id.toString
              ? comp.product._id.toString()
              : comp.product && comp.product._id
              ? String(comp.product._id)
              : undefined;
          if (!id) return;
          desiredComponents.set(id, comp);
        });

        for (const setItem of product.setItems) {
          const component = setItem.product;
          if (!component) {
            res.status(400);
            throw new Error(`Set ${product.name} contains an invalid item reference.`);
          }

          const componentId = component._id.toString();
          const required = requestedQuantity * (Number(setItem.quantity) || 1);
          const desiredComponent = desiredComponents.get(componentId);
          const hasTakenFlag =
            desiredComponent && Object.prototype.hasOwnProperty.call(desiredComponent, 'taken');
          const desiredTaken = hasTakenFlag ? Boolean(desiredComponent.taken) : true;

          let taken = desiredTaken;
          let reason = desiredComponent?.reason;

          if (taken) {
            if (getProjectedStock(componentId, newStockMap, stockChanges) < required) {
              res.status(400);
              throw new Error(
                `Insufficient stock for ${component.name} in set ${product.name}. Required: ${required}, Available: ${component.stock}`
              );
            }
            accumulateStockChange(stockChanges, componentId, -required);
          } else {
            itemStatus = 'partial';
            if (!reason) {
              reason = hasTakenFlag ? 'Marked as not taken' : 'Insufficient stock at issuance';
            }
          }

          componentDetails.push({
            productId: component._id,
            name: component.name,
            quantity: required,
            taken,
            reason: taken ? undefined : reason,
          });
        }
      } else {
        if (getProjectedStock(productId, newStockMap, stockChanges) < requestedQuantity) {
          res.status(400);
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${requestedQuantity}`);
        }

        accumulateStockChange(stockChanges, productId, -requestedQuantity);
      }

      const itemTotal = requestedQuantity * Number(item.price);
      totalAmount += itemTotal;
      const transactionItem = {
        productId: item.productId,
        name: item.name || product.name,
        quantity: requestedQuantity,
        price: Number(item.price),
        total: itemTotal,
        status: itemStatus,
        isSet: Boolean(product.isSet),
      };

      if (product.isSet) {
        transactionItem.setComponents = componentDetails;
      }

      validatedItems.push(transactionItem);
    }

    await applyStockChanges(stockChanges);

    transaction.items = validatedItems;
    transaction.totalAmount = totalAmount;

    // Update student's items map
    const student = await User.findById(transaction.student.userId);
    if (student) {
      const updatedItems = { ...(student.items || {}) };
      validatedItems.forEach(item => {
        const productName = item.name;
        const key = productName.toLowerCase().replace(/\s+/g, '_');
        updatedItems[key] = true;
      });
      student.items = updatedItems;
      await student.save();
    }
  }

  if (paymentMethod !== undefined) {
    transaction.paymentMethod = paymentMethod;
  }

  if (isPaid !== undefined) {
    transaction.isPaid = isPaid;
    transaction.paidAt = isPaid ? new Date() : null;

    // Update student's paid status
    const student = await User.findById(transaction.student.userId);
    if (student) {
      student.paid = isPaid;
      await student.save();
    }
  }

  if (remarks !== undefined) {
    transaction.remarks = remarks;
  }

  const updatedTransaction = await transaction.save();
  res.status(200).json(updatedTransaction);
});

/**
 * @desc    Delete a transaction
 * @route   DELETE /api/transactions/:id
 * @access  Public
 */
const deleteTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  // Restore product stock when deleting transaction
  if (transaction.items && transaction.items.length > 0) {
    const restoreIds = new Set(transaction.items.map((item) => item.productId));
    const { productMap: restoreProductMap } = await loadProductsWithComponents(restoreIds);
    const restoreChanges = new Map();

    for (const item of transaction.items) {
      const productId = item.productId.toString();
      const product = restoreProductMap.get(productId);
      if (!product) continue;

      if (
        product.isSet &&
        Array.isArray(item.setComponents) &&
        item.setComponents.length > 0
      ) {
        item.setComponents.forEach((component) => {
          if (!component?.taken) return;
          if (!component?.productId) return;
          const qty = Number(component.quantity) || 0;
          if (qty > 0) {
            accumulateStockChange(restoreChanges, component.productId, qty);
          }
        });
      } else if (product.isSet && product.setItems?.length) {
        for (const setItem of product.setItems) {
          const component = setItem?.product;
          if (!component) continue;
          const componentId = component._id.toString();
          const restoredQty = item.quantity * (Number(setItem.quantity) || 1);
          accumulateStockChange(restoreChanges, componentId, restoredQty);
        }
      } else {
        accumulateStockChange(restoreChanges, productId, item.quantity);
      }
    }

    await applyStockChanges(restoreChanges);
  }

  await Transaction.findByIdAndDelete(req.params.id);
  res.status(200).json({ message: 'Transaction deleted successfully' });
});

/**
 * @desc    Get transactions by student ID
 * @route   GET /api/transactions/student/:studentId
 * @access  Public
 */
const getTransactionsByStudent = asyncHandler(async (req, res) => {
  const student = await User.findById(req.params.studentId);

  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const transactions = await Transaction.find({ 'student.userId': student._id })
    .populate('items.productId', 'name price imageUrl')
    .sort({ transactionDate: -1 });

  res.status(200).json(transactions);
});

module.exports = {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getTransactionsByStudent,
};

