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
    student: {
      userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true, 
        ref: 'User' 
      },
      name: { type: String, required: true },
      studentId: { type: String, required: true },
      course: { type: String, required: true },
      year: { type: Number, required: true },
      branch: { type: String, default: '' },
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
      enum: ['cash', 'online'],
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

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = { Transaction };

