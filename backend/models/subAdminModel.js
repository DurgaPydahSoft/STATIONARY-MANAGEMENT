const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const subAdminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true, // used as login ID
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      default: 'Editor',
      enum: ['Administrator', 'Editor', 'Viewer', 'Accountant'],
    },
    permissions: {
      type: [String],
      default: [],
      // Permissions will be based on sidebar menu items
      // e.g., ['dashboard', 'add-student', 'student-management', 'courses', 'manage-stock', 'transactions', 'settings']
    },
  },
  { timestamps: true }
);

subAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

subAdminSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

const SubAdmin = mongoose.model('SubAdmin', subAdminSchema);

module.exports = { SubAdmin };


