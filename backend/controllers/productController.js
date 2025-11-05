const { Product } = require('../models/productModel');

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
  const { name, description, price, stock, imageUrl, forCourse, branch, years, year, remarks } = req.body;
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
  
  // sanitize numeric fields
  const parsedPrice = price !== undefined && price !== null && price !== '' ? Number(price) : 0;
  let parsedStock = stock !== undefined && stock !== null && stock !== '' ? Number(stock) : 0;

    const product = new Product({
      name,
      description: description || '', // Description is optional, can be added later
      price: parsedPrice,
      category: 'Other', // Default category since we're removing it from form
      stock: parsedStock,
      imageUrl,
      forCourse: forCourse || '',
      branch: branch || '',
      years: parsedYears,
      year: parsedYears.length === 1 ? parsedYears[0] : (parsedYears.length === 0 ? 0 : parsedYears[0]), // Backward compatibility
      remarks: remarks || '',
      lastPriceUpdated: new Date(), // Set initial price update date
    });

    const createdProduct = await product.save();
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
    const products = await Product.find(filter);
    res.status(200).json(products);
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
    const product = await Product.findById(req.params.id);

    if (product) {
      res.status(200).json(product);
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
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

  const { name, description, price, stock, imageUrl, forCourse, branch, years, year, remarks } = req.body;
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

    // Track price change before updating
    const oldPrice = product.price;
    const newPrice = price !== undefined && price !== null && price !== '' ? Number(price) : product.price;
    
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
    product.stock = stock ?? product.stock;
    product.imageUrl = imageUrl ?? product.imageUrl;
    product.forCourse = forCourse ?? product.forCourse;
    product.branch = branch ?? product.branch;
    if (parsedYears !== undefined) {
      product.years = parsedYears;
      product.year = parsedYears.length === 1 ? parsedYears[0] : (parsedYears.length === 0 ? 0 : parsedYears[0]); // Backward compatibility
    }
    product.remarks = remarks !== undefined ? remarks : product.remarks;

    const updated = await product.save();
    res.json(updated);
  } catch (error) {
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
    try {
      const key = product.name.toLowerCase().replace(/\s+/g, '_');
      const { User } = require('../models/userModel');
      // Unset the nested items.<key> field for all users
      await User.updateMany({ [`items.${key}`]: { $exists: true } }, { $unset: { [`items.${key}`]: "" } });
    } catch (innerErr) {
      // Log but don't fail the deletion if user update fails
      console.error('Failed to remove item key from users:', innerErr);
    }

    res.json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
};

module.exports = { createProduct, getProducts, getProductById, updateProduct, deleteProduct };