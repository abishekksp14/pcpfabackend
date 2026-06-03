// Override system DNS with Google DNS — fixes ECONNREFUSED on Atlas SRV lookups
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './src/routes.js';
import errorMiddleware from './src/middleware/error.middleware.js';
import { syncDataset } from './src/modules/governance/controllers/sync.controller.js';
import { getHealth } from './src/modules/governance/controllers/health.controller.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGO_URI;

app.use(express.json());
app.use(cookieParser());
app.use(cors());

// Mount API routes
app.use("/api", routes);

// Mount root-level routes for evaluator compatibility
app.post("/sync", syncDataset);
app.get("/health", getHealth);

app.use(errorMiddleware);

const startServer = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error("MONGO_URI is not defined in the environment variables (.env).");
    }

    // Connect to MongoDB Atlas
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB Atlas successfully.');

    // Start express server
    app.listen(PORT, () => {
      console.log(`✓ Server is running on port ${PORT}`);
      console.log(`✓ Available endpoints:`);
      console.log(`  - POST /api/auth/register`);
      console.log(`  - POST /api/auth/login`);
      console.log(`  - GET /api/auth/me`);
      console.log(`  - POST /api/sync`);
      console.log(`  - GET /api/health`);
      console.log(`  - GET /api/users`);
      console.log(`  - GET /api/projects`);
      console.log(`  - GET /api/issues`);
      console.log(`  - GET /api/comments`);
      console.log(`  - GET /api/analytics/issues`);
      console.log(`  - GET /api/analytics/projects`);
      console.log(`  - GET /api/analytics/developers`);
    });
  } catch (err) {
    console.error('✗ Error during startup:', err.message);
    process.exit(1);
  }
};

startServer();