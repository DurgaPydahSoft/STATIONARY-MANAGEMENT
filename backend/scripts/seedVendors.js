/*
 * Script: seedVendors.js
 * Usage: NODE_ENV=production MONGO_URI="mongodb+srv://..." node backend/scripts/seedVendors.js
 * Description: Inserts sample vendor master data, including bank details.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Vendor } = require('../models/vendorModel');

const vendors = [
  {
    name: 'Alpha Stationers',
    contactPerson: 'Manoj Babu',
    email: 'orders@alphastationers.in',
    phone: '+91-98765-12345',
    address: '12-1-45, Market Road, Vizag, Andhra Pradesh - 530001',
    gstNumber: '37ABCPA1234L1ZS',
    paymentTerms: 'Net 30 days',
    remarks: 'Preferred stationery supplier for notebooks and drawing kits.',
    isActive: true,
    bankDetails: {
      accountHolderName: 'Alpha Stationers Pvt Ltd',
      bankName: 'State Bank of India',
      branchName: 'Seethammadhara',
      accountNumber: '123456789012',
      ifscCode: 'SBIN0012345',
      upiId: 'alphastationers@oksbi',
    },
  },
  {
    name: 'LabMart Enterprises',
    contactPerson: 'Priya Nair',
    email: 'sales@labmart.in',
    phone: '+91-98480-54321',
    address: 'Plot 22, Industrial Estate, Gajuwaka, Vizag - 530026',
    gstNumber: '37ACDPL5678P1ZZ',
    paymentTerms: '50% advance, balance on delivery',
    remarks: 'Supplies lab coats and lab accessories. Minimum order 10 units.',
    isActive: true,
    bankDetails: {
      accountHolderName: 'LabMart Enterprises',
      bankName: 'HDFC Bank',
      branchName: 'Gajuwaka',
      accountNumber: '998877665544',
      ifscCode: 'HDFC0005678',
      upiId: 'labmart@hdfcbank',
    },
  },
  {
    name: 'TechTools Distributors',
    contactPerson: 'Arjun Deshmukh',
    email: 'support@techtools.in',
    phone: '+91-90000-11122',
    address: 'Unit 304, Sunrise Towers, Madhapur, Hyderabad - 500081',
    gstNumber: '36AADCT9876N1Z2',
    paymentTerms: 'Net 45 days',
    remarks: 'Distributor for calculators and electronic tools.',
    isActive: true,
    bankDetails: {
      accountHolderName: 'TechTools Distributors LLP',
      bankName: 'ICICI Bank',
      branchName: 'Madhapur',
      accountNumber: '556677889900',
      ifscCode: 'ICIC0001234',
      upiId: 'techtools@icici',
    },
  },
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

async function seedVendors() {
  try {
    await connect();

    const vendorNames = vendors.map(v => v.name);
    await Vendor.deleteMany({ name: { $in: vendorNames } });

    const created = await Vendor.insertMany(vendors);
    console.log(`Inserted ${created.length} vendors.`);
  } catch (err) {
    console.error('Failed to seed vendors:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedVendors();

