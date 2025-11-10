const express = require("express");
const { connectDB } = require("./config/db"); // Assuming db.js is in a 'config' folder
const productRoutes = require("./routes/productRoutes");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const dotenv = require("dotenv");
const subAdminRoutes = require("./routes/subAdminRoutes");
const academicConfigRoutes = require("./routes/academicConfigRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const stockEntryRoutes = require("./routes/stockEntryRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// CORS configuration
const allowedOrigins = [
  "https://pydah-stationary-management.vercel.app",
  "http://localhost:5173",
  "http://localhost:5000",
  "http://localhost:3000",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Log for debugging
      console.log("CORS blocked request from:", origin);
      console.log("Allowed origins:", allowedOrigins);
      // For development, allow all origins
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        // In production, be strict but log the issue
        console.error(`CORS Error: Origin ${origin} not allowed`);
        callback(new Error("Not allowed by CORS"));
      }
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-auth-token",
    "Origin",
    "Accept",
    "X-Requested-With",
  ],
  exposedHeaders: ["Authorization"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400, // 24 hours
};

// Enable CORS
app.use(cors(corsOptions));

// Additional CORS headers middleware (fallback)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token, Origin, Accept, X-Requested-With');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  
  next();
});

// Middleware to parse JSON
app.use(express.json());

// Sample route
app.get("/", (req, res) => {
  res.send("Server is running! 😉");
});

// Mount product routes
app.use("/api/products", productRoutes);

// Mount user routes
app.use("/api", userRoutes);
// Mount sub-admin routes
app.use("/api", subAdminRoutes);
// Mount academic config routes
app.use("/api", academicConfigRoutes);
// Mount transaction routes
app.use("/api/transactions", transactionRoutes);
// Mount vendor routes
app.use("/api/vendors", vendorRoutes);
// Mount stock entry routes
app.use("/api/stock-entries", stockEntryRoutes);
// Settings routes
app.use("/api/settings", settingsRoutes);
// Audit log routes
app.use("/api/audit-logs", auditLogRoutes);

// Error handling middleware (must be after all routes)
app.use((err, req, res, next) => {
  console.error("Error:", err);
  console.error("Stack:", err.stack);
  const statusCode = err.statusCode || res.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log("Enjoy your day! 😉");
});
