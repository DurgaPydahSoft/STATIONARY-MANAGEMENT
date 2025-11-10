const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    beforeQuantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
    },
    afterQuantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    createdBy: {
      type: String,
      trim: true,
      default: 'System',
    },
    approvedBy: {
      type: String,
      trim: true,
    },
    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = { AuditLog };

