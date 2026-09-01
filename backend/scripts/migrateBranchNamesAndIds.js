const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { getMySqlPool } = require('../config/mysql');
const { Product } = require('../models/productModel');

const normalize = (val) => {
  if (!val) return '';
  return String(val).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Custom manual mappings for branch names that were renamed structurally
const CUSTOM_BRANCH_MAPPINGS = {
  'dcseai': 'daim',
  'dcseaiml': 'daim',
  'pharmd': 'pharmd',
  'pharm d': 'pharmd'
};

async function main() {
  let mysqlPool;
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/stationery';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    mysqlPool = getMySqlPool();
    if (!mysqlPool) {
      console.error('MySQL configuration not found/invalid.');
      process.exit(1);
    }
    console.log('Connected to MySQL.');

    // 1. Fetch active courses and branches from MySQL
    const [sqlCourses] = await mysqlPool.query("SELECT id, name FROM courses WHERE is_active = 1");
    const [sqlBranches] = await mysqlPool.query("SELECT id, course_id, name FROM course_branches WHERE is_active = 1");

    console.log(`Fetched ${sqlCourses.length} courses and ${sqlBranches.length} branches from MySQL.`);

    // 2. Fetch all MongoDB products
    const products = await Product.find({});
    console.log(`Processing ${products.length} MongoDB products/sets...`);

    let updatedCount = 0;

    for (const product of products) {
      let isModified = false;
      const originalCourse = product.forCourse;
      const originalCourseId = product.forCourseId;
      const originalBranches = [...(product.branch || [])];
      const originalBranchIds = [...(product.branchIds || [])];

      // Match Course
      let matchedCourse = null;
      if (product.forCourse) {
        const normProductCourse = normalize(product.forCourse);
        matchedCourse = sqlCourses.find(c => normalize(c.name) === normProductCourse);
        
        if (matchedCourse) {
          if (product.forCourseId !== matchedCourse.id) {
            product.forCourseId = matchedCourse.id;
            isModified = true;
          }
          if (product.forCourse !== matchedCourse.name) {
            product.forCourse = matchedCourse.name;
            isModified = true;
          }
        } else {
          console.warn(`⚠️ Could not find MySQL course match for product "${product.name}" course: "${product.forCourse}"`);
        }
      }

      // Match Branches
      if (Array.isArray(product.branch) && product.branch.length > 0 && matchedCourse) {
        const newBranches = [];
        const newBranchIds = [];

        for (const rawBranch of product.branch) {
          if (!rawBranch) continue;
          
          let normBranch = normalize(rawBranch);
          // Apply custom manual mapping overrides
          if (CUSTOM_BRANCH_MAPPINGS[normBranch]) {
            normBranch = CUSTOM_BRANCH_MAPPINGS[normBranch];
          }

          // Search active branches under the matched course
          const matchedBranch = sqlBranches.find(b => 
            b.course_id === matchedCourse.id && 
            (normalize(b.name) === normBranch || CUSTOM_BRANCH_MAPPINGS[normalize(b.name)] === normBranch)
          );

          if (matchedBranch) {
            newBranches.push(matchedBranch.name);
            newBranchIds.push(matchedBranch.id);
          } else {
            console.warn(`⚠️ Could not find MySQL branch match for product "${product.name}" branch: "${rawBranch}" under course "${matchedCourse.name}"`);
            // Keep original branch name if we cannot find a match
            newBranches.push(rawBranch);
          }
        }

        // Compare branch arrays
        const branchNamesChanged = JSON.stringify(product.branch) !== JSON.stringify(newBranches);
        const branchIdsChanged = JSON.stringify(product.branchIds) !== JSON.stringify(newBranchIds);

        if (branchNamesChanged) {
          product.branch = newBranches;
          isModified = true;
        }
        if (branchIdsChanged) {
          product.branchIds = newBranchIds;
          isModified = true;
        }
      }

      if (isModified) {
        await product.save();
        updatedCount++;
        console.log(`✅ Updated Product "${product.name}":`);
        console.log(`   Course: "${originalCourse}" (ID: ${originalCourseId}) -> "${product.forCourse}" (ID: ${product.forCourseId})`);
        console.log(`   Branches: [${originalBranches.join(', ')}] (IDs: [${originalBranchIds.join(', ')}]) -> [${product.branch.join(', ')}] (IDs: [${product.branchIds.join(', ')}])`);
      }
    }

    console.log(`\n🎉 Completed migration. Updated ${updatedCount} out of ${products.length} products.`);

  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await mongoose.disconnect();
    if (mysqlPool) await mysqlPool.end();
    console.log('Finished.');
  }
}

main();
