/*
 * Script: seedSuperAdmin.js
 * Usage: NODE_ENV=production MONGO_URI="mongodb+srv://..." node backend/scripts/seedSuperAdmin.js
 * Description: Inserts (or updates) the Super Admin sub-admin account.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { SubAdmin } = require('../models/subAdminModel');

const SUPERADMIN_NAME = 'superadmin';
const SUPERADMIN_PASSWORD = 'superadmin123';
const ALL_PERMISSIONS = [
  'dashboard',
  'add-student',
  'student-management',
  'student-dashboard',
  'course-dashboard',
  'courses',
  'manage-stock',
  'transactions',
  'settings',
];

async function connect() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is not set.');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log('Connected to MongoDB');
}

async function seedSuperAdmin() {
  try {
    await connect();

    let superAdmin = await SubAdmin.findOne({ name: SUPERADMIN_NAME }).select('+password');

    if (!superAdmin) {
      superAdmin = await SubAdmin.create({
        name: SUPERADMIN_NAME,
        password: SUPERADMIN_PASSWORD,
        role: 'Administrator',
        permissions: ALL_PERMISSIONS,
      });
      console.log('Super admin created.');
    } else {
      let shouldSave = false;

      if (superAdmin.role !== 'Administrator') {
        superAdmin.role = 'Administrator';
        shouldSave = true;
      }

      const hasAllPermissions = ALL_PERMISSIONS.every(perm => superAdmin.permissions?.includes(perm));
      if (!hasAllPermissions) {
        superAdmin.permissions = Array.from(new Set([...(superAdmin.permissions || []), ...ALL_PERMISSIONS]));
        shouldSave = true;
      }

      const passwordMatches = await superAdmin.comparePassword(SUPERADMIN_PASSWORD);
      if (!passwordMatches) {
        superAdmin.password = SUPERADMIN_PASSWORD; // will hash via pre-save hook
        shouldSave = true;
      }

      if (shouldSave) {
        await superAdmin.save();
        console.log('Super admin updated.');
      } else {
        console.log('Super admin already up to date.');
      }
    }
  } catch (err) {
    console.error('Failed to seed super admin:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedSuperAdmin();

