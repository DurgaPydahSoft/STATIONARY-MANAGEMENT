const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductById,
  previewProductImpact,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');

// @route   GET /api/products
// @route   POST /api/products
router.route('/').get(getProducts).post(createProduct);

// @route   GET /api/products/:id
router.post('/:id/impact-preview', previewProductImpact);
router.route('/:id').get(getProductById).put(updateProduct).delete(deleteProduct);

module.exports = router;