require('dotenv').config();
const mongoose = require('mongoose');
const { AcademicConfig } = require('../models/academicConfigModel');

const courses = [
  {
    name: 'btech',
    displayName: 'B.Tech',
    years: [1, 2, 3, 4],
    branches: ['Computer Science', 'Electronics', 'Electrical', 'Civil', 'Mechanical'],
  },
  {
    name: 'diploma',
    displayName: 'Diploma',
    years: [1, 2, 3],
    branches: ['Mechanical', 'Electrical'],
  },
  {
    name: 'degree',
    displayName: 'Degree',
    years: [1, 2, 3],
    branches: ['Commerce', 'Science', 'Arts'],
  },
];

const normalizeCourse = (course) => {
  return {
    name: String(course.name || '').trim().toLowerCase(),
    displayName: String(course.displayName || course.name || '').trim(),
    years: Array.from(new Set((course.years || []).map(Number))).filter(Boolean).sort((a, b) => a - b),
    branches: Array.from(new Set((course.branches || []).map(String))).filter(Boolean),
  };
};

async function connect() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is not set.');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log('Connected to MongoDB');
}

async function seedCourses() {
  try {
    await connect();

    const normalizedCourses = courses.map(normalizeCourse);

    let config = await AcademicConfig.findOne();

    if (!config) {
      config = await AcademicConfig.create({ courses: normalizedCourses });
      console.log(`Created academic configuration with ${normalizedCourses.length} courses.`);
    } else {
      config.courses = normalizedCourses;
      await config.save();
      console.log(`Updated academic configuration with ${normalizedCourses.length} courses.`);
    }
  } catch (error) {
    console.error('Failed to seed courses:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedCourses();

