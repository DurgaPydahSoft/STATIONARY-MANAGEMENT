const mongoose = require('mongoose');

// Branch stock schema - tracks product stock at each branch
const branchStockSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Product',
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
  },
  { _id: false }
);

// Branch schema for stock transfer locations (campuses/stations)
const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide branch name'],
      trim: true,
      unique: true,
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Stock inventory for this branch - array of {product, quantity}
    stock: {
      type: [branchStockSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Stock transfer item schema - for multiple products in a transfer
const transferItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Product',
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
  },
  { _id: false }
);

// Stock transfer schema - transfers FROM central stock TO branches
const stockTransferSchema = new mongoose.Schema(
  {
    // Support multiple products in a single transfer
    items: {
      type: [transferItemSchema],
      required: [true, 'Please provide at least one product'],
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one product is required',
      },
    },
    toBranch: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Please provide destination branch'],
      ref: 'TransferBranch',
    },
    transferDate: {
      type: Date,
      default: Date.now,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    deductFromCentral: {
      type: Boolean,
      default: true,
    },
    includeInRevenue: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: String,
      trim: true,
      default: 'System',
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
stockTransferSchema.index({ 'items.product': 1, createdAt: -1 });
stockTransferSchema.index({ toBranch: 1 });
stockTransferSchema.index({ status: 1, createdAt: -1 });
stockTransferSchema.index({ transferDate: -1 });
stockTransferSchema.index({ transactionId: 1 });
stockTransferSchema.index({ isPaid: 1 });

branchSchema.index({ name: 1 }, { unique: true });
branchSchema.index({ isActive: 1 });
branchSchema.index({ 'stock.product': 1 });

const StockTransfer = mongoose.model('StockTransfer', stockTransferSchema);
const TransferBranch = mongoose.model('TransferBranch', branchSchema);

module.exports = { StockTransfer, TransferBranch };

