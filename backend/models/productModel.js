const mongoose = require('mongoose');
const { getCourseConnection } = require('../config/db');

// Define the schema for a product
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a product name'],
      trim: true,
    },
    description: {
      type: String,
      maxlength: [250, 'Description cannot exceed 250 characters'],
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Please provide a product price'],
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: String,
      required: [true, 'Please specify a category'],
      enum: ['Notebooks', 'Pens', 'Art Supplies', 'Electronics', 'Other'],
    },
    // Which course this product belongs to (e.g., b.tech, diploma, degree). If blank, it's global
    forCourse: {
      type: String,
      trim: true,
      default: '',
    },
    // Which years this product applies to (array of years: [1,2,3,4]). Empty array means applies to all years
    years: {
      type: [Number],
      default: [],
      validate: {
        validator: function(v) {
          return v.every(year => year >= 0 && year <= 10);
        },
        message: 'Each year must be between 0 and 10'
      }
    },
    // Keep year field for backward compatibility (will be deprecated)
    year: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    // Optional branch applicability (e.g., CSE, ECE)
    branch: {
      type: String,
      trim: true,
      default: '',
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    imageUrl: {
      type: String,
    },
    // Remarks for internal/admin notes
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    // Price management fields
    lastPriceUpdated: {
      type: Date,
      default: Date.now,
    },
    // Price history log (optional future enhancement)
    priceHistory: [{
      price: { type: Number, required: true },
      updatedAt: { type: Date, default: Date.now },
      updatedBy: { type: String, default: 'System' },
    }],
  },
  {
    // Automatically add 'createdAt' and 'updatedAt' fields
    timestamps: true,
  }
);

// Factory function to get Product model for a specific course
const getProductModel = async (course) => {
  try {
    // Sanitize course name and await the connection
    const connection = await getCourseConnection(course.replace(/\./g, ''));
    return connection.model('Product', productSchema);
  } catch (error) {
    console.error(`Error getting Product model for course ${course}:`, error);
    throw error;
  }
};

// Pre-save middleware to ensure lastPriceUpdated is set on new products
productSchema.pre('save', function(next) {
  // If this is a new product and lastPriceUpdated is not set, set it to now
  if (this.isNew && !this.lastPriceUpdated) {
    this.lastPriceUpdated = new Date();
  }
  next();
});

// Default model for main database (backward compatibility)
const Product = mongoose.model('Product', productSchema);

module.exports = { Product, getProductModel };