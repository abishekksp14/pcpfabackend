import express from "express";

import authRoutes from "./modules/identity/auth.routes.js";
import issueTrackerRoutes from "./modules/governance/issueTracker.routes.js";

import { syncDataset } from "./modules/governance/controllers/sync.controller.js";
import { getHealth } from "./modules/governance/controllers/health.controller.js";

const router = express.Router();

// Auth and Sync / Health Routes
router.use("/auth", authRoutes);
router.post("/sync", syncDataset);
router.get("/health", getHealth);

// Issue Tracker REST routes mounted directly under /api prefix
router.use("/", issueTrackerRoutes);

export default router;
