const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { getMySqlPool } = require('../config/mysql');
const { Product } = require('../models/productModel');

async function main() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/stationery';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const mysqlPool = getMySqlPool();
    if (!mysqlPool) {
      console.error('MySQL configuration not found/invalid.');
      process.exit(1);
    }
    console.log('Connected to MySQL.');

    // 1. Fetch MongoDB products data
    const products = await Product.find({});
    console.log(`Found ${products.length} products/sets in MongoDB.`);

    const mongoCourses = new Set();
    const mongoBranches = new Set();
    const mongoCourseIds = new Set();
    const mongoBranchIds = new Set();

    products.forEach(p => {
      if (p.forCourse) mongoCourses.add(p.forCourse);
      if (p.forCourseId) mongoCourseIds.add(p.forCourseId);
      if (Array.isArray(p.branch)) {
        p.branch.forEach(b => mongoBranches.add(b));
      }
      if (Array.isArray(p.branchIds)) {
        p.branchIds.forEach(id => mongoBranchIds.add(id));
      }
    });

    console.log('\n--- MongoDB Distinct Configured Values ---');
    console.log('Courses (names):', Array.from(mongoCourses));
    console.log('Course IDs:', Array.from(mongoCourseIds));
    console.log('Branches (names):', Array.from(mongoBranches));
    console.log('Branch IDs:', Array.from(mongoBranchIds));

    // 2. Fetch MySQL Courses
    const [sqlCourses] = await mysqlPool.query("SELECT id, name FROM courses WHERE is_active = 1");
    console.log('\n--- MySQL Active Courses ---');
    sqlCourses.forEach(c => {
      console.log(`ID: ${c.id} | Name: "${c.name}"`);
    });

    // 3. Fetch MySQL Branches
    const [sqlBranches] = await mysqlPool.query("SELECT id, course_id, name FROM course_branches WHERE is_active = 1");
    console.log('\n--- MySQL Active Branches ---');
    sqlBranches.forEach(b => {
      console.log(`ID: ${b.id} | Course ID: ${b.course_id} | Name: "${b.name}"`);
    });

  } catch (error) {
    console.error('Error running diagnostic:', error);
  } finally {
    await mongoose.disconnect();
    const mysqlPool = getMySqlPool();
    if (mysqlPool) await mysqlPool.end();
    console.log('\nFinished.');
  }
}

main();
