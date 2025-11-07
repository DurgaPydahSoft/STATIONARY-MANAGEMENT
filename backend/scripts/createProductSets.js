/*
 * Script: createProductSets.js
 * Usage: NODE_ENV=production MONGO_URI="mongodb+srv://..." node backend/scripts/createProductSets.js
 * Description: Creates bundled set products by referencing existing standalone products.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Product } = require('../models/productModel');

// Define the sets using existing product names. Adjust the names to match your catalog exactly.
const sets = [
  {
    name: 'B.Tech 1st Year Starter Kit',
    description: 'Essential tools for first-year B.Tech students.',
    price: 1990,
    remarks: 'Includes calculator, drawing kit, and notebooks at a bundled price.',
    forCourse: 'btech',
    years: [1],
    items: [
      { name: 'Engineering Drawing Kit', quantity: 1 },
      { name: 'Scientific Calculator FX-991MS', quantity: 1 },
      { name: 'Notebook Pack (A4, 5 pcs)', quantity: 1 },
    ],
  },
  {
    name: 'Science Lab Essentials Pack',
    description: 'Lab coat and stationery essentials for laboratory sessions.',
    price: 1250,
    remarks: 'Perfect for science degree students.',
    forCourse: 'degree',
    years: [1, 2],
    items: [
      { name: 'Lab Coat (Medium)', quantity: 1 },
      { name: 'Notebook Pack (A4, 5 pcs)', quantity: 1 },
    ],
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

async function createSets() {
  try {
    await connect();

    for (const set of sets) {
      const existingSet = await Product.findOne({ name: set.name });
      if (existingSet) {
        console.log(`Skipping '${set.name}' (already exists).`);
        continue;
      }

      const productDocs = await Product.find({ name: { $in: set.items.map(i => i.name) } });
      const productMap = new Map(productDocs.map(doc => [doc.name, doc]));

      const missing = set.items.filter(item => !productMap.has(item.name));
      if (missing.length > 0) {
        console.warn(`Cannot create set '${set.name}'. Missing products: ${missing.map(m => m.name).join(', ')}`);
        continue;
      }

      const setItems = set.items.map(item => {
        const product = productMap.get(item.name);
        return {
          product: product._id,
          quantity: item.quantity,
          productNameSnapshot: product.name,
          productPriceSnapshot: product.price,
        };
      });

      const setProduct = new Product({
        name: set.name,
        description: set.description,
        price: set.price,
        stock: 0,
        category: 'Other',
        remarks: set.remarks || '',
        forCourse: set.forCourse || '',
        years: set.years || [],
        isSet: true,
        setItems,
        lowStockThreshold: 0,
      });

      await setProduct.save();
      console.log(`Created set '${set.name}' with ${setItems.length} referenced products.`);
    }
  } catch (err) {
    console.error('Failed to create product sets:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createSets();

