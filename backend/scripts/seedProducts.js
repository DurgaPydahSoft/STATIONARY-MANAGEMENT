/*
 * Script: seedProducts.js
 * Usage: NODE_ENV=production MONGO_URI="mongodb+srv://..." node backend/scripts/seedProducts.js
 * Description: Inserts a set of sample standalone products into the catalog.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Product } = require('../models/productModel');

const products = [
  {
    name: 'Engineering Drawing Kit',
    description: 'Complete drawing kit with pencils, compass, divider, and eraser.',
    price: 450,
    stock: 40,
    remarks: 'Recommended for first-year engineering students',
    forCourse: 'btech',
    years: [1],
    lowStockThreshold: 10,
  },
  {
    name: 'Scientific Calculator FX-991MS',
    description: 'Casio scientific calculator with 401 functions.',
    price: 990,
    stock: 25,
    remarks: 'Must-have for engineering and diploma students',
    forCourse: '',
    years: [],
    lowStockThreshold: 8,
  },
  {
    name: 'Notebook Pack (A4, 5 pcs)',
    description: 'A4 ruled notebooks (5 pack) with 160 pages each.',
    price: 250,
    stock: 120,
    remarks: 'Bulk order discount applied',
    forCourse: '',
    years: [],
    lowStockThreshold: 20,
  },
  {
    name: 'Lab Coat (Medium)',
    description: 'White cotton lab coat for chemistry labs.',
    price: 600,
    stock: 18,
    remarks: 'Limited sizes available',
    forCourse: 'degree',
    years: [1, 2],
    lowStockThreshold: 5,
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

async function seedProducts() {
  try {
    await connect();

    const productNames = products.map(p => p.name);
    await Product.deleteMany({ name: { $in: productNames } });

    const created = await Product.insertMany(products.map(product => ({
      ...product,
      category: 'Other',
      isSet: false,
      setItems: [],
    })));

    console.log(`Inserted ${created.length} products.`);
  } catch (err) {
    console.error('Failed to seed products:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedProducts();

