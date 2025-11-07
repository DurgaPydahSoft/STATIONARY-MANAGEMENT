/*
 * Script: seedStudents.js
 * Usage: NODE_ENV=production MONGO_URI="mongodb+srv://..." node backend/scripts/seedStudents.js
 * Description: Inserts a set of sample students into the main `User` collection.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../models/userModel');

const students = [
  // BTech - Computer Science (Year 1)
  {
    name: 'Aarav Kumar',
    email: 'aarav.kumar@pydah.edu',
    password: 'password123',
    studentId: 'BT-2025-001',
    course: 'btech',
    branch: 'Computer Science',
    year: 1,
  },
  {
    name: 'Neha Patel',
    email: 'neha.patel@pydah.edu',
    password: 'password123',
    studentId: 'BT-2025-002',
    course: 'btech',
    branch: 'Computer Science',
    year: 1,
  },
  {
    name: 'Rohan Singh',
    email: 'rohan.singh@pydah.edu',
    password: 'password123',
    studentId: 'BT-2025-003',
    course: 'btech',
    branch: 'Computer Science',
    year: 1,
  },

  // BTech - Computer Science (Year 2)
  {
    name: 'Isha Sharma',
    email: 'isha.sharma@pydah.edu',
    password: 'password123',
    studentId: 'BT-2024-001',
    course: 'btech',
    branch: 'Computer Science',
    year: 2,
  },
  {
    name: 'Arjun Mehta',
    email: 'arjun.mehta@pydah.edu',
    password: 'password123',
    studentId: 'BT-2024-002',
    course: 'btech',
    branch: 'Computer Science',
    year: 2,
  },
  {
    name: 'Priya Reddy',
    email: 'priya.reddy@pydah.edu',
    password: 'password123',
    studentId: 'BT-2024-003',
    course: 'btech',
    branch: 'Computer Science',
    year: 2,
  },

  // BTech - Electronics (Year 1)
  {
    name: 'Siddharth Joshi',
    email: 'siddharth.joshi@pydah.edu',
    password: 'password123',
    studentId: 'BT-2025-101',
    course: 'btech',
    branch: 'Electronics',
    year: 1,
  },
  {
    name: 'Ananya Das',
    email: 'ananya.das@pydah.edu',
    password: 'password123',
    studentId: 'BT-2025-102',
    course: 'btech',
    branch: 'Electronics',
    year: 1,
  },

  // BTech - Electronics (Year 2)
  {
    name: 'Vikram Malhotra',
    email: 'vikram.malhotra@pydah.edu',
    password: 'password123',
    studentId: 'BT-2024-101',
    course: 'btech',
    branch: 'Electronics',
    year: 2,
  },
  {
    name: 'Pooja Gupta',
    email: 'pooja.gupta@pydah.edu',
    password: 'password123',
    studentId: 'BT-2024-102',
    course: 'btech',
    branch: 'Electronics',
    year: 2,
  },

  // BTech - Mechanical (Year 1)
  {
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@pydah.edu',
    password: 'password123',
    studentId: 'BT-2025-201',
    course: 'btech',
    branch: 'Mechanical',
    year: 1,
  },
  {
    name: 'Sunita Mishra',
    email: 'sunita.mishra@pydah.edu',
    password: 'password123',
    studentId: 'BT-2025-202',
    course: 'btech',
    branch: 'Mechanical',
    year: 1,
  },

  // BTech - Mechanical (Year 2)
  {
    name: 'Amit Choudhary',
    email: 'amit.choudhary@pydah.edu',
    password: 'password123',
    studentId: 'BT-2024-201',
    course: 'btech',
    branch: 'Mechanical',
    year: 2,
  },
  {
    name: 'Deepika Sharma',
    email: 'deepika.sharma@pydah.edu',
    password: 'password123',
    studentId: 'BT-2024-202',
    course: 'btech',
    branch: 'Mechanical',
    year: 2,
  },

  // BTech - Civil (Year 1)
  {
    name: 'Karan Singh',
    email: 'karan.singh@pydah.edu',
    password: 'password123',
    studentId: 'BT-2025-301',
    course: 'btech',
    branch: 'Civil',
    year: 1,
  },
  {
    name: 'Meera Nair',
    email: 'meera.nair@pydah.edu',
    password: 'password123',
    studentId: 'BT-2025-302',
    course: 'btech',
    branch: 'Civil',
    year: 1,
  },

  // Diploma - Mechanical
  {
    name: 'Rahul Verma',
    email: 'rahul.verma@pydah.edu',
    password: 'password123',
    studentId: 'DIP-2024-101',
    course: 'diploma',
    branch: 'Mechanical',
    year: 3,
  },
  {
    name: 'Sanjay Rao',
    email: 'sanjay.rao@pydah.edu',
    password: 'password123',
    studentId: 'DIP-2024-102',
    course: 'diploma',
    branch: 'Mechanical',
    year: 2,
  },
  {
    name: 'Laxmi Devi',
    email: 'laxmi.devi@pydah.edu',
    password: 'password123',
    studentId: 'DIP-2025-101',
    course: 'diploma',
    branch: 'Mechanical',
    year: 1,
  },

  // Diploma - Electronics
  {
    name: 'Manoj Tiwari',
    email: 'manoj.tiwari@pydah.edu',
    password: 'password123',
    studentId: 'DIP-2024-201',
    course: 'diploma',
    branch: 'Electronics',
    year: 3,
  },
  {
    name: 'Kavita Singh',
    email: 'kavita.singh@pydah.edu',
    password: 'password123',
    studentId: 'DIP-2025-201',
    course: 'diploma',
    branch: 'Electronics',
    year: 1,
  },

  // Degree - Commerce
  {
    name: 'Saanvi Rao',
    email: 'saanvi.rao@pydah.edu',
    password: 'password123',
    studentId: 'DEG-2023-050',
    course: 'degree',
    branch: 'Commerce',
    year: 1,
  },
  {
    name: 'Aditya Kapoor',
    email: 'aditya.kapoor@pydah.edu',
    password: 'password123',
    studentId: 'DEG-2024-051',
    course: 'degree',
    branch: 'Commerce',
    year: 2,
  },
  {
    name: 'Nisha Yadav',
    email: 'nisha.yadav@pydah.edu',
    password: 'password123',
    studentId: 'DEG-2025-052',
    course: 'degree',
    branch: 'Commerce',
    year: 1,
  },

  // Degree - Arts
  {
    name: 'Ritu Sharma',
    email: 'ritu.sharma@pydah.edu',
    password: 'password123',
    studentId: 'DEG-2024-101',
    course: 'degree',
    branch: 'Arts',
    year: 2,
  },
  {
    name: 'Vishal Kumar',
    email: 'vishal.kumar@pydah.edu',
    password: 'password123',
    studentId: 'DEG-2025-102',
    course: 'degree',
    branch: 'Arts',
    year: 1,
  },

  // Degree - Science
  {
    name: 'Anjali Mishra',
    email: 'anjali.mishra@pydah.edu',
    password: 'password123',
    studentId: 'DEG-2024-151',
    course: 'degree',
    branch: 'Science',
    year: 2,
  },
  {
    name: 'Rahul Bose',
    email: 'rahul.bose@pydah.edu',
    password: 'password123',
    studentId: 'DEG-2025-152',
    course: 'degree',
    branch: 'Science',
    year: 1,
  },

  // BTech - Final Year Students
  {
    name: 'Akash Thakur',
    email: 'akash.thakur@pydah.edu',
    password: 'password123',
    studentId: 'BT-2022-001',
    course: 'btech',
    branch: 'Computer Science',
    year: 4,
  },
  {
    name: 'Nandini Roy',
    email: 'nandini.roy@pydah.edu',
    password: 'password123',
    studentId: 'BT-2022-002',
    course: 'btech',
    branch: 'Electronics',
    year: 4,
  },
  {
    name: 'Ravi Shankar',
    email: 'ravi.shankar@pydah.edu',
    password: 'password123',
    studentId: 'BT-2022-003',
    course: 'btech',
    branch: 'Mechanical',
    year: 4,
  }
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

async function seedStudents() {
  try {
    await connect();

    const existingIds = students.map(s => s.studentId);
    await User.deleteMany({ studentId: { $in: existingIds } });

    const created = await User.insertMany(students);
    console.log(`Inserted ${created.length} students.`);
    
    // Log distribution by course and branch
    const distribution = {};
    students.forEach(student => {
      const key = `${student.course}-${student.branch}-Year${student.year}`;
      distribution[key] = (distribution[key] || 0) + 1;
    });
    
    console.log('\nStudent Distribution:');
    console.log('====================');
    Object.entries(distribution).forEach(([key, count]) => {
      console.log(`${key}: ${count} students`);
    });
    
  } catch (err) {
    console.error('Failed to seed students:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedStudents();