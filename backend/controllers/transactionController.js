const { Transaction } = require('../models/transactionModel');
const { User } = require('../models/userModel');
const { Product } = require('../models/productModel');
const asyncHandler = require('express-async-handler');

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

  // Calculate total and validate items
  let totalAmount = 0;
  const validatedItems = [];

  for (const item of items) {
    if (!item.productId || !item.quantity || !item.price) {
      res.status(400);
      throw new Error('Each item must have productId, quantity, and price');
    }

    // Verify product exists
    const product = await Product.findById(item.productId);
    if (!product) {
      res.status(404);
      throw new Error(`Product not found: ${item.productId}`);
    }

    // Check stock availability
    const requestedQuantity = Number(item.quantity);
    if (product.stock < requestedQuantity) {
      res.status(400);
      throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${requestedQuantity}`);
    }

    const itemTotal = requestedQuantity * Number(item.price);
    totalAmount += itemTotal;

    validatedItems.push({
      productId: item.productId,
      name: item.name || product.name,
      quantity: requestedQuantity,
      price: Number(item.price),
      total: itemTotal,
    });
  }

  // Update product stock after validation
  for (const item of validatedItems) {
    const product = await Product.findById(item.productId);
    if (product) {
      product.stock -= item.quantity;
      if (product.stock < 0) {
        product.stock = 0; // Prevent negative stock
      }
      await product.save();
    }
  }

  // Generate unique transaction ID
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const transactionId = `TXN-${timestamp}-${randomStr}`;

  // Create transaction
  const transaction = await Transaction.create({
    transactionId,
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
  const { course, studentId, paymentMethod, isPaid } = req.query;
  
  const filter = {};
  
  if (course) {
    filter['student.course'] = course;
  }
  
  if (studentId) {
    const student = await User.findById(studentId);
    if (student) {
      filter['student.userId'] = student._id;
    }
  }
  
  if (paymentMethod) {
    filter.paymentMethod = paymentMethod;
  }
  
  if (isPaid !== undefined) {
    filter.isPaid = isPaid === 'true';
  }

  const transactions = await Transaction.find(filter)
    .populate('items.productId', 'name price imageUrl')
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
      for (const oldItem of transaction.items) {
        const product = await Product.findById(oldItem.productId);
        if (product) {
          product.stock += oldItem.quantity;
          await product.save();
        }
      }
    }

    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || !item.price) {
        res.status(400);
        throw new Error('Each item must have productId, quantity, and price');
      }

      const product = await Product.findById(item.productId);
      if (!product) {
        res.status(404);
        throw new Error(`Product not found: ${item.productId}`);
      }

      // Check stock availability
      const requestedQuantity = Number(item.quantity);
      if (product.stock < requestedQuantity) {
        res.status(400);
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${requestedQuantity}`);
      }

      const itemTotal = requestedQuantity * Number(item.price);
      totalAmount += itemTotal;

      validatedItems.push({
        productId: item.productId,
        name: item.name || product.name,
        quantity: requestedQuantity,
        price: Number(item.price),
        total: itemTotal,
      });
    }

    // Update product stock after validation
    for (const item of validatedItems) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.stock -= item.quantity;
        if (product.stock < 0) {
          product.stock = 0; // Prevent negative stock
        }
        await product.save();
      }
    }

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
    for (const item of transaction.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }
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

