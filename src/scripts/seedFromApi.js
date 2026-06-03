/**
 * Seed Script — Fetches dataset from external API, validates, sanitizes,
 * and persists valid records into MongoDB Atlas.
 *
 * Usage: node src/scripts/seedFromApi.js
 */

import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import axios from "axios";
import { hashPassword } from "../utils/password.util.js";

// Models
import User from "../modules/identity/models/user.model.js";
import Project from "../modules/governance/models/project.model.js";
import Issue from "../modules/governance/models/issue.model.js";
import Comment from "../modules/governance/models/comment.model.js";
import ActivityLog from "../modules/governance/models/activityLog.model.js";

// ─── Config ──────────────────────────────────────────────────────
const BASE_URL = "https://t4e-testserver.onrender.com/api";
const STUDENT_ID = "E0323053";
const PASSWORD = "769434";
const SET = "setB";
const MONGO_URI = process.env.MONGO_URI;

// ─── Validation helpers ──────────────────────────────────────────
const VALID_ROLES = ["admin", "manager", "developer", "tester"];
const VALID_USER_STATUS = ["active", "inactive"];
const VALID_PROJECT_STATUS = ["active", "inactive", "completed", "archived"];
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];
const VALID_SEVERITIES = ["minor", "major", "critical", "blocker"];
const VALID_ISSUE_STATUS = ["open", "in-progress", "testing", "resolved", "closed"];
const VALID_ACTIONS = ["created", "assigned", "status_changed", "resolved", "closed", "reopened"];

function isValidDate(d) {
  if (!d) return false;
  const date = new Date(d);
  return !isNaN(date.getTime());
}

// ─── Validate & sanitize each collection ─────────────────────────

function validateUsers(rawUsers) {
  const seen = new Set();
  const valid = [];
  const rejected = [];

  for (const u of rawUsers) {
    const userId = u.userId?.trim();
    const name = u.name?.trim();
    const email = u.email?.trim()?.toLowerCase();
    const role = u.role?.trim()?.toLowerCase();
    const department = u.department?.trim();
    const status = (u.status?.trim()?.toLowerCase()) || "active";

    // Reject conditions
    if (!userId || !name || !email) {
      rejected.push({ reason: "Missing required fields", data: u });
      continue;
    }
    if (!VALID_ROLES.includes(role)) {
      rejected.push({ reason: `Invalid role '${u.role}'`, data: u });
      continue;
    }
    if (!VALID_USER_STATUS.includes(status)) {
      rejected.push({ reason: `Invalid status '${u.status}'`, data: u });
      continue;
    }
    if (seen.has(userId)) {
      rejected.push({ reason: `Duplicate userId '${userId}'`, data: u });
      continue;
    }
    seen.add(userId);

    valid.push({ userId, name, email, role, department, status });
  }

  return { valid, rejected };
}

function validateProjects(rawProjects) {
  const seen = new Set();
  const valid = [];
  const rejected = [];

  for (const p of rawProjects) {
    const projectId = p.projectId?.trim();
    const title = p.title?.trim();
    const description = p.description?.trim();
    const owner = p.owner?.trim();
    const status = (p.status?.trim()?.toLowerCase()) || "active";
    const startDate = p.startDate || p.startdate;

    if (!projectId || !title) {
      rejected.push({ reason: "Missing required fields", data: p });
      continue;
    }
    if (!VALID_PROJECT_STATUS.includes(status)) {
      rejected.push({ reason: `Invalid status '${p.status}'`, data: p });
      continue;
    }
    if (seen.has(projectId)) {
      rejected.push({ reason: `Duplicate projectId '${projectId}'`, data: p });
      continue;
    }
    seen.add(projectId);

    const doc = { projectId, title, status };
    if (description) doc.description = description;
    if (owner) doc.owner = owner;
    if (p.members) doc.members = p.members;
    if (startDate && isValidDate(startDate)) doc.startDate = new Date(startDate);

    valid.push(doc);
  }

  return { valid, rejected };
}

function validateIssues(rawIssues, validProjectIds, validUserIds) {
  const seen = new Set();
  const valid = [];
  const rejected = [];

  for (const i of rawIssues) {
    const issueId = i.issueId?.trim();
    const title = i.title?.trim();
    const projectId = i.projectId?.trim();
    const assignedTo = i.assignedTo?.trim();
    const reportedBy = i.reportedBy?.trim();
    const priority = i.priority?.trim()?.toLowerCase();
    const severity = i.severity?.trim()?.toLowerCase();
    const status = (i.status?.trim()?.toLowerCase()) || "open";
    const dueDate = i.dueDate;

    if (!issueId || !title) {
      rejected.push({ reason: "Missing required fields", data: i });
      continue;
    }
    if (!VALID_PRIORITIES.includes(priority)) {
      rejected.push({ reason: `Invalid priority '${i.priority}'`, data: i });
      continue;
    }
    if (severity && !VALID_SEVERITIES.includes(severity)) {
      rejected.push({ reason: `Invalid severity '${i.severity}'`, data: i });
      continue;
    }
    if (!VALID_ISSUE_STATUS.includes(status)) {
      rejected.push({ reason: `Invalid status '${i.status}'`, data: i });
      continue;
    }
    if (!validProjectIds.has(projectId)) {
      rejected.push({ reason: `Invalid project reference '${projectId}'`, data: i });
      continue;
    }
    if (assignedTo && !validUserIds.has(assignedTo)) {
      rejected.push({ reason: `Invalid assignedTo user '${assignedTo}'`, data: i });
      continue;
    }
    if (reportedBy && !validUserIds.has(reportedBy)) {
      rejected.push({ reason: `Invalid reportedBy user '${reportedBy}'`, data: i });
      continue;
    }
    if (dueDate && !isValidDate(dueDate)) {
      rejected.push({ reason: `Invalid dueDate '${dueDate}'`, data: i });
      continue;
    }
    if (seen.has(issueId)) {
      rejected.push({ reason: `Duplicate issueId '${issueId}'`, data: i });
      continue;
    }
    seen.add(issueId);

    const doc = { issueId, title, projectId, priority, status };
    if (i.description) doc.description = i.description.trim();
    if (assignedTo) doc.assignedTo = assignedTo;
    if (reportedBy) doc.reportedBy = reportedBy;
    if (severity) doc.severity = severity;
    if (dueDate) doc.dueDate = new Date(dueDate);

    valid.push(doc);
  }

  return { valid, rejected };
}

function validateComments(rawComments, validIssueIds, validUserIds) {
  const seen = new Set();
  const valid = [];
  const rejected = [];

  for (const c of rawComments) {
    const commentId = c.commentId?.trim();
    const issueId = c.issueId?.trim();
    const userId = c.userId?.trim();
    const message = c.message?.trim();
    const createdAt = c.createdAt;

    if (!commentId || !issueId || !userId) {
      rejected.push({ reason: "Missing required fields", data: c });
      continue;
    }
    if (!message || message.length === 0) {
      rejected.push({ reason: "Empty message", data: c });
      continue;
    }
    if (!validIssueIds.has(issueId)) {
      rejected.push({ reason: `Invalid issue reference '${issueId}'`, data: c });
      continue;
    }
    if (!validUserIds.has(userId)) {
      rejected.push({ reason: `Invalid user reference '${userId}'`, data: c });
      continue;
    }
    if (createdAt && !isValidDate(createdAt)) {
      rejected.push({ reason: `Invalid date '${createdAt}'`, data: c });
      continue;
    }
    if (seen.has(commentId)) {
      rejected.push({ reason: `Duplicate commentId '${commentId}'`, data: c });
      continue;
    }
    seen.add(commentId);

    const doc = { commentId, issueId, userId, message };
    if (createdAt) doc.createdAt = new Date(createdAt);

    valid.push(doc);
  }

  return { valid, rejected };
}

function validateActivities(rawLogs, validIssueIds, validUserIds) {
  const seen = new Set();
  const valid = [];
  const rejected = [];

  for (const l of rawLogs) {
    const logId = l.logId?.trim();
    const issueId = l.issueId?.trim();
    const userId = l.userId?.trim();
    const action = l.action?.trim()?.toLowerCase();
    const previousStatus = l.previousStatus?.trim()?.toLowerCase() || null;
    const newStatus = l.newStatus?.trim()?.toLowerCase() || null;
    const timestamp = l.timestamp;

    if (!logId || !issueId) {
      rejected.push({ reason: "Missing required fields", data: l });
      continue;
    }
    if (!action) {
      rejected.push({ reason: "Missing action", data: l });
      continue;
    }
    if (!VALID_ACTIONS.includes(action)) {
      rejected.push({ reason: `Invalid action '${l.action}'`, data: l });
      continue;
    }
    if (!validIssueIds.has(issueId)) {
      rejected.push({ reason: `Invalid issue reference '${issueId}'`, data: l });
      continue;
    }
    if (userId && !validUserIds.has(userId)) {
      rejected.push({ reason: `Invalid user reference '${userId}'`, data: l });
      continue;
    }
    if (previousStatus && !VALID_ISSUE_STATUS.includes(previousStatus)) {
      rejected.push({ reason: `Invalid previousStatus '${l.previousStatus}'`, data: l });
      continue;
    }
    if (newStatus && !VALID_ISSUE_STATUS.includes(newStatus)) {
      rejected.push({ reason: `Invalid newStatus '${l.newStatus}'`, data: l });
      continue;
    }
    if (timestamp && !isValidDate(timestamp)) {
      rejected.push({ reason: `Invalid timestamp '${timestamp}'`, data: l });
      continue;
    }
    if (seen.has(logId)) {
      rejected.push({ reason: `Duplicate logId '${logId}'`, data: l });
      continue;
    }
    seen.add(logId);

    const doc = { logId, issueId, action };
    if (userId) doc.userId = userId;
    if (previousStatus) doc.previousStatus = previousStatus;
    if (newStatus) doc.newStatus = newStatus;
    if (timestamp) doc.timestamp = new Date(timestamp);

    valid.push(doc);
  }

  return { valid, rejected };
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  SEED SCRIPT — Fetch, Validate & Persist to MongoDB  ");
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. Connect to MongoDB
  console.log("1️⃣  Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGO_URI);
  console.log("   ✅ Connected!\n");

  // 2. Fetch external token
  console.log("2️⃣  Fetching token from external API...");
  const tokenRes = await axios.post(`${BASE_URL}/public/token`, {
    studentId: STUDENT_ID,
    password: PASSWORD,
    set: SET,
  });
  const { token, dataUrl } = tokenRes.data;
  console.log(`   ✅ Token received. Data URL: ${dataUrl}\n`);

  // 3. Fetch dataset
  console.log("3️⃣  Fetching dataset...");
  const dataRes = await axios.get(`${BASE_URL}${dataUrl}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = dataRes.data.data;
  console.log(`   ✅ Fetched: ${raw.users?.length} users, ${raw.projects?.length} projects, ${raw.issues?.length} issues, ${raw.comments?.length} comments, ${raw.activities_log?.length} activity logs\n`);

  // 4. Validate & sanitize
  console.log("4️⃣  Validating & sanitizing records...\n");

  const usersResult = validateUsers(raw.users || []);
  console.log(`   👤 Users:      ${usersResult.valid.length} valid, ${usersResult.rejected.length} rejected`);

  const validUserIds = new Set(usersResult.valid.map((u) => u.userId));

  const projectsResult = validateProjects(raw.projects || []);
  console.log(`   📁 Projects:   ${projectsResult.valid.length} valid, ${projectsResult.rejected.length} rejected`);

  const validProjectIds = new Set(projectsResult.valid.map((p) => p.projectId));

  const issuesResult = validateIssues(raw.issues || [], validProjectIds, validUserIds);
  console.log(`   🐛 Issues:     ${issuesResult.valid.length} valid, ${issuesResult.rejected.length} rejected`);

  const validIssueIds = new Set(issuesResult.valid.map((i) => i.issueId));

  const commentsResult = validateComments(raw.comments || [], validIssueIds, validUserIds);
  console.log(`   💬 Comments:   ${commentsResult.valid.length} valid, ${commentsResult.rejected.length} rejected`);

  const activitiesResult = validateActivities(raw.activities_log || [], validIssueIds, validUserIds);
  console.log(`   📝 Activities: ${activitiesResult.valid.length} valid, ${activitiesResult.rejected.length} rejected`);

  // Print rejection reasons
  const allRejected = [
    ...usersResult.rejected.map((r) => ({ collection: "users", ...r })),
    ...projectsResult.rejected.map((r) => ({ collection: "projects", ...r })),
    ...issuesResult.rejected.map((r) => ({ collection: "issues", ...r })),
    ...commentsResult.rejected.map((r) => ({ collection: "comments", ...r })),
    ...activitiesResult.rejected.map((r) => ({ collection: "activities", ...r })),
  ];

  if (allRejected.length > 0) {
    console.log(`\n   ⚠️  Rejected records (${allRejected.length} total):`);
    for (const r of allRejected) {
      const id = r.data.userId || r.data.projectId || r.data.issueId || r.data.commentId || r.data.logId || "?";
      console.log(`      ❌ [${r.collection}] ${id}: ${r.reason}`);
    }
  }

  // 5. Clear existing data and insert
  console.log("\n5️⃣  Clearing existing collections...");
  await User.deleteMany({});
  await Project.deleteMany({});
  await Issue.deleteMany({});
  await Comment.deleteMany({});
  await ActivityLog.deleteMany({});
  console.log("   ✅ Collections cleared.\n");

  console.log("6️⃣  Inserting valid records into MongoDB Atlas...");

  // Hash a default password for all synced users
  const defaultHash = await hashPassword("password123");

  const usersToInsert = usersResult.valid.map((u) => ({
    ...u,
    password: defaultHash,
  }));

  const insertedUsers = await User.insertMany(usersToInsert);
  console.log(`   👤 Users:      ${insertedUsers.length} inserted`);

  const insertedProjects = await Project.insertMany(projectsResult.valid);
  console.log(`   📁 Projects:   ${insertedProjects.length} inserted`);

  const insertedIssues = await Issue.insertMany(issuesResult.valid);
  console.log(`   🐛 Issues:     ${insertedIssues.length} inserted`);

  const insertedComments = await Comment.insertMany(commentsResult.valid);
  console.log(`   💬 Comments:   ${insertedComments.length} inserted`);

  const insertedActivities = await ActivityLog.insertMany(activitiesResult.valid);
  console.log(`   📝 Activities: ${insertedActivities.length} inserted`);

  // 7. Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ SYNC COMPLETE — Summary");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Total fetched:   ${(raw.users?.length || 0) + (raw.projects?.length || 0) + (raw.issues?.length || 0) + (raw.comments?.length || 0) + (raw.activities_log?.length || 0)}`);
  console.log(`  Total valid:     ${usersResult.valid.length + projectsResult.valid.length + issuesResult.valid.length + commentsResult.valid.length + activitiesResult.valid.length}`);
  console.log(`  Total rejected:  ${allRejected.length}`);
  console.log(`  Total inserted:  ${insertedUsers.length + insertedProjects.length + insertedIssues.length + insertedComments.length + insertedActivities.length}`);
  console.log("═══════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB. Done! 🎉");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message || err);
  process.exit(1);
});
