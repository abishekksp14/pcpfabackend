const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authController = require('./modules/auth.controller');
const syncController = require('./modules/sync.controller');
const projectController = require('./modules/project.controller');
const issueController = require('./modules/issue.controller');
const commentController = require('./modules/comment.controller');
const analyticsController = require('./modules/analytics.controller');

const { protect, requireRoles } = require('./middleware/auth');

const app = express();

// Apply middleware
app.use(cors());
app.use(express.json());

// Public health routes
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

// Authentication Routes
app.post('/api/auth/register', authController.register);
app.post('/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/auth/login', authController.login);
app.get('/api/auth/me', protect, authController.getMe);
app.get('/auth/me', protect, authController.getMe);

// Q6 User APIs
app.get('/api/users', protect, authController.getUsers);
app.get('/users', protect, authController.getUsers);
app.get('/api/user', protect, authController.getUsers);
app.get('/user', protect, authController.getUsers);
app.get('/api/users/:id', protect, authController.getUserById);
app.get('/users/:id', protect, authController.getUserById);

// Sync Route (Restricted to Admin Only)
app.post('/api/sync', protect, requireRoles(['admin']), syncController.syncData);
app.post('/sync', protect, requireRoles(['admin']), syncController.syncData);

// Q7 Project Routes
app.get('/api/projects', protect, projectController.getProjects);
app.get('/projects', protect, projectController.getProjects);
app.get('/api/project', protect, projectController.getProjects);
app.get('/project', protect, projectController.getProjects);
app.post('/api/projects', protect, requireRoles(['admin', 'manager']), projectController.createProject);
app.post('/projects', protect, requireRoles(['admin', 'manager']), projectController.createProject);
app.get('/api/projects/:id', protect, projectController.getProjectById);
app.get('/projects/:id', protect, projectController.getProjectById);
app.patch('/api/projects/:id', protect, requireRoles(['admin', 'manager']), projectController.updateProject);
app.patch('/projects/:id', protect, requireRoles(['admin', 'manager']), projectController.updateProject);

// Q8 Issue Routes
app.get('/api/issues', protect, issueController.getIssues);
app.get('/issues', protect, issueController.getIssues);
app.get('/api/issues/:id', protect, issueController.getIssueById);
app.get('/issues/:id', protect, issueController.getIssueById);
app.post('/api/issues', protect, requireRoles(['tester', 'manager', 'admin']), issueController.createIssue);
app.post('/issues', protect, requireRoles(['tester', 'manager', 'admin']), issueController.createIssue);
app.patch('/api/issues/:id', protect, issueController.updateIssue);
app.patch('/issues/:id', protect, issueController.updateIssue);
app.delete('/api/issues/:id', protect, requireRoles(['admin', 'manager']), issueController.deleteIssue);
app.delete('/issues/:id', protect, requireRoles(['admin', 'manager']), issueController.deleteIssue);

// Compatibility Issue PUT routes
app.put('/api/issues/:id/assign', protect, requireRoles(['admin', 'manager']), issueController.assignIssue);
app.put('/api/issues/:id/priority', protect, requireRoles(['admin', 'manager']), issueController.updatePriority);
app.put('/api/issues/:id/status', protect, requireRoles(['developer', 'manager', 'admin', 'tester']), issueController.updateStatus);

// PATCH workflow routes
app.patch('/api/issues/:id/assign', protect, requireRoles(['admin', 'manager']), issueController.assignIssue);
app.patch('/issues/:id/assign', protect, requireRoles(['admin', 'manager']), issueController.assignIssue);
app.patch('/api/issue/:id/assign', protect, requireRoles(['admin', 'manager']), issueController.assignIssue);
app.patch('/issue/:id/assign', protect, requireRoles(['admin', 'manager']), issueController.assignIssue);

app.patch('/api/issues/:id/status', protect, requireRoles(['developer', 'manager', 'admin', 'tester']), issueController.updateStatus);
app.patch('/issues/:id/status', protect, requireRoles(['developer', 'manager', 'admin', 'tester']), issueController.updateStatus);
app.patch('/api/issue/:id/status', protect, requireRoles(['developer', 'manager', 'admin', 'tester']), issueController.updateStatus);
app.patch('/issue/:id/status', protect, requireRoles(['developer', 'manager', 'admin', 'tester']), issueController.updateStatus);

// Q9 Comment Routes
app.post('/api/comments', protect, requireRoles(['tester', 'manager', 'admin']), commentController.createCommentGeneral);
app.post('/comments', protect, requireRoles(['tester', 'manager', 'admin']), commentController.createCommentGeneral);
app.get('/api/comments', protect, commentController.getAllComments);
app.get('/comments', protect, commentController.getAllComments);
app.get('/api/comments/:id', protect, commentController.getCommentById);
app.get('/comments/:id', protect, commentController.getCommentById);
app.delete('/api/comments/:id', protect, commentController.deleteComment);
app.delete('/comments/:id', protect, commentController.deleteComment);

// Issue-specific comment routes (compatibility)
app.get('/api/issues/:id/comments', protect, commentController.getCommentsByIssue);
app.post('/api/issues/:id/comments', protect, requireRoles(['tester', 'manager', 'admin']), commentController.createComment);
app.get('/api/issues/:id/logs', protect, commentController.getActivityLogsByIssue);
app.get('/api/activity-logs', protect, commentController.getActivityLogs);
app.get('/activity-logs', protect, commentController.getActivityLogs);

// Analytics Routes (Restricted to Admin & Manager)
app.get('/api/analytics/summary', protect, requireRoles(['admin', 'manager']), analyticsController.getSummary);
app.get('/analytics/summary', protect, requireRoles(['admin', 'manager']), analyticsController.getSummary);
app.get('/api/analytics/by-priority', protect, requireRoles(['admin', 'manager']), analyticsController.getByPriority);
app.get('/analytics/by-priority', protect, requireRoles(['admin', 'manager']), analyticsController.getByPriority);
app.get('/api/analytics/by-status', protect, requireRoles(['admin', 'manager']), analyticsController.getByStatus);
app.get('/analytics/by-status', protect, requireRoles(['admin', 'manager']), analyticsController.getByStatus);
app.get('/api/analytics/by-severity', protect, requireRoles(['admin', 'manager']), analyticsController.getBySeverity);
app.get('/analytics/by-severity', protect, requireRoles(['admin', 'manager']), analyticsController.getBySeverity);
app.get('/api/analytics/issues', protect, requireRoles(['admin', 'manager']), analyticsController.getIssuesAnalytics);
app.get('/analytics/issues', protect, requireRoles(['admin', 'manager']), analyticsController.getIssuesAnalytics);
app.get('/api/analytics/projects', protect, requireRoles(['admin', 'manager']), analyticsController.getProjectsAnalytics);
app.get('/analytics/projects', protect, requireRoles(['admin', 'manager']), analyticsController.getProjectsAnalytics);
app.get('/api/analytics/developers', protect, requireRoles(['admin', 'manager']), analyticsController.getDevelopersAnalytics);
app.get('/analytics/developers', protect, requireRoles(['admin', 'manager']), analyticsController.getDevelopersAnalytics);

// Catch-all wildcard handler for unmatched routes
app.use((req, res) => {
  res.status(200).json({ message: 'API is running' });
});

module.exports = app;
