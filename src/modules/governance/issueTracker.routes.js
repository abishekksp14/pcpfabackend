import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { hasRole } from "../../middleware/role.middleware.js";

// Controllers
import * as usersController from "./controllers/users.controller.js";
import * as projectsController from "./controllers/projects.controller.js";
import * as issuesController from "./controllers/issues.controller.js";
import * as commentsController from "./controllers/comments.controller.js";
import * as analyticsController from "./controllers/analytics.controller.js";

const router = express.Router();

// ─── User Routes ────────────────────────────────────────────────
router.get("/user", protect, usersController.getUsers);
router.get("/users", protect, usersController.getUsers);
router.get("/users/:id", protect, usersController.getUserById);

// ─── Project Routes ─────────────────────────────────────────────
router.post("/projects", protect, hasRole("admin", "manager"), projectsController.createProject);
router.get("/projects", protect, projectsController.getProjects);
router.get("/projects/:id", protect, projectsController.getProjectById);
router.patch("/projects/:id", protect, hasRole("admin", "manager"), projectsController.updateProject);

// ─── Issue Routes ──────────────────────────────────────────────
router.post("/issues", protect, hasRole("admin", "manager", "tester"), issuesController.createIssue);
router.get("/issues", protect, issuesController.getIssues);
router.get("/issues/:id", protect, issuesController.getIssueById);
router.patch("/issues/:id", protect, issuesController.updateIssue);
router.delete("/issues/:id", protect, hasRole("admin", "manager"), issuesController.deleteIssue);

// Workflow Routes (support both singular and plural forms)
router.patch("/issues/:id/assign", protect, hasRole("admin", "manager"), issuesController.assignIssue);
router.patch("/issue/:id/assign", protect, hasRole("admin", "manager"), issuesController.assignIssue);

router.patch("/issues/:id/status", protect, issuesController.updateIssueStatus);
router.patch("/issue/:id/status", protect, issuesController.updateIssueStatus);

// ─── Comment Routes ─────────────────────────────────────────────
router.post("/comments", protect, hasRole("admin", "manager", "tester"), commentsController.createComment);
router.get("/comments", protect, commentsController.getComments);
router.get("/comments/:id", protect, commentsController.getCommentById);
router.delete("/comments/:id", protect, hasRole("admin", "manager"), commentsController.deleteComment);

// ─── Analytics Routes ───────────────────────────────────────────
router.get("/analytics/issues", protect, hasRole("admin", "manager"), analyticsController.getIssueAnalytics);
router.get("/analytics/projects", protect, hasRole("admin", "manager"), analyticsController.getProjectAnalytics);
router.get("/analytics/developers", protect, hasRole("admin", "manager"), analyticsController.getDeveloperAnalytics);

export default router;
