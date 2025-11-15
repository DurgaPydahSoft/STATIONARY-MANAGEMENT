const mongoose = require('mongoose');

// Define the schema for a transaction
const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // Transaction type: 'student' or 'branch_transfer'
    transactionType: {
      type: String,
      enum: ['student', 'branch_transfer'],
      default: 'student',
    },
    student: {
      userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: function() { return this.transactionType === 'student'; },
        ref: 'User' 
      },
      name: { type: String, required: function() { return this.transactionType === 'student'; } },
      studentId: { type: String, required: function() { return this.transactionType === 'student'; } },
      course: { type: String, required: function() { return this.transactionType === 'student'; } },
      year: { type: Number, required: function() { return this.transactionType === 'student'; } },
      branch: { type: String, default: '' },
    },
    // Branch transfer details (for branch_transfer type)
    branchTransfer: {
      branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TransferBranch',
        required: function() { return this.transactionType === 'branch_transfer'; },
      },
      branchName: {
        type: String,
        required: function() { return this.transactionType === 'branch_transfer'; },
      },
      branchLocation: {
        type: String,
        default: '',
      },
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: 'Product',
        },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
        isSet: { type: Boolean, default: false },
        status: {
          type: String,
          enum: ['fulfilled', 'partial'],
          default: 'fulfilled',
        },
        setComponents: [
          {
            productId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Product',
            },
            name: { type: String, required: false, trim: true },
            quantity: { type: Number, min: 0, default: 0 },
            taken: { type: Boolean, default: true },
            reason: { type: String, trim: true, default: '' },
          },
        ],
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['cash', 'online', 'transfer'],
      default: 'cash',
    },
    isPaid: {
      type: Boolean,
      required: true,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
transactionSchema.index({ 'student.userId': 1 });
transactionSchema.index({ 'student.course': 1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ transactionDate: -1 });
transactionSchema.index({ transactionType: 1 });
transactionSchema.index({ 'branchTransfer.branchId': 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = { Transaction };

