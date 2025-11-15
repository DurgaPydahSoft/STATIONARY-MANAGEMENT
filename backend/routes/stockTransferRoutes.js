const express = require('express');
const router = express.Router();
const {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchStock,
  getBranchStockAll,
  createStockTransfer,
  getStockTransfers,
  getStockTransferById,
  updateStockTransfer,
  deleteStockTransfer,
  completeStockTransfer,
} = require('../controllers/stockTransferController');

// Branch routes
router.route('/branches').get(getBranches).post(createBranch);
router.route('/branches/:id').put(updateBranch).delete(deleteBranch);
router.route('/branches/:id/stock').get(getBranchStockAll);
router.route('/branches/:id/stock/:productId').get(getBranchStock);

// Transfer routes
router.route('/').post(createStockTransfer).get(getStockTransfers);
router.route('/:id').get(getStockTransferById).put(updateStockTransfer).delete(deleteStockTransfer);
router.route('/:id/complete').post(completeStockTransfer);

module.exports = router;

