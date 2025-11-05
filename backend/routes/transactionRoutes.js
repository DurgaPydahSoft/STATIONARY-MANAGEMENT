const express = require('express');
const router = express.Router();
const {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getTransactionsByStudent,
} = require('../controllers/transactionController');

// @route   POST /api/transactions
// @route   GET /api/transactions
router.route('/').post(createTransaction).get(getAllTransactions);

// @route   GET /api/transactions/student/:studentId
router.get('/student/:studentId', getTransactionsByStudent);

// @route   GET /api/transactions/:id
// @route   PUT /api/transactions/:id
// @route   DELETE /api/transactions/:id
router.route('/:id').get(getTransactionById).put(updateTransaction).delete(deleteTransaction);

module.exports = router;

