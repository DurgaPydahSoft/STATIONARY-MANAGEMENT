const express = require('express');
const { connectDB } = require('./config/db'); // Assuming db.js is in a 'config' folder
const productRoutes = require('./routes/productRoutes');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const dotenv = require('dotenv');
const subAdminRoutes = require('./routes/subAdminRoutes');
const academicConfigRoutes = require('./routes/academicConfigRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();


// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
       "https://pydah-stationary-management.vercel.app/",
  "https://pydah-stationary-management.vercel.app",
      'http://localhost:5173',
      'http://localhost:5000'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked request from:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-auth-token',
    'Origin',
    'Accept',
    'X-Requested-With'
  ],
  exposedHeaders: ['Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours
};

// Enable CORS
app.use(cors(corsOptions));

// Middleware to parse JSON
app.use(express.json());

// Sample route
app.get('/', (req, res) => {
  res.send('Server is running! 😉');
});

// Mount product routes
app.use('/api/products', productRoutes);

// Mount user routes
app.use('/api', userRoutes);
// Mount sub-admin routes
app.use('/api', subAdminRoutes);
// Mount academic config routes
app.use('/api', academicConfigRoutes);
// Mount transaction routes
app.use('/api/transactions', transactionRoutes);

// Error handling middleware (must be after all routes)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  const statusCode = err.statusCode || res.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log("Enjoy your day! 😉");
});
