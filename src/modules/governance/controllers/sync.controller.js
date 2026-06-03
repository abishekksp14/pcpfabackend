import axios from "axios";
import mongoose from "mongoose";
import { hashPassword } from "../../../utils/password.util.js";

// Models
import User from "../../identity/models/user.model.js";
import Project from "../models/project.model.js";
import Issue from "../models/issue.model.js";
import Comment from "../models/comment.model.js";
import ActivityLog from "../models/activityLog.model.js";

// Enums
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

export const syncDataset = async (req, res, next) => {
  try {
    const studentId = process.env.STUDENT_ID;
    const password = process.env.PASSWORD;
    const set = process.env.SET_NAME;
    const BASE_URL = process.env.EXTERNAL_API_BASE_URL || "https://t4e-testserver.onrender.com/api";

    if (!studentId || !password || !set) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required environment variables: STUDENT_ID, PASSWORD, SET_NAME" 
      });
    }

    // 1. Fetch token
    const tokenRes = await axios.post(`${BASE_URL}/public/token`, {
      studentId,
      password,
      set
    });
    const { token, dataUrl } = tokenRes.data;

    // 2. Fetch dataset
    const dataRes = await axios.get(`${BASE_URL}${dataUrl}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const raw = dataRes.data.data;
    if (!raw) {
      return res.status(400).json({ success: false, message: "No data returned from external API" });
    }

    // 3. Validation lists
    const usersValid = [];
    const usersRejected = [];
    const usersSeen = new Set();

    for (const u of raw.users || []) {
      const userId = u.userId?.trim();
      const name = u.name?.trim();
      const email = u.email?.trim()?.toLowerCase();
      const role = u.role?.trim()?.toLowerCase();
      const department = u.department?.trim();
      const status = u.status?.trim()?.toLowerCase() || "active";

      if (!userId || !name || !email) {
        usersRejected.push({ reason: "Missing required fields", data: u });
        continue;
      }
      if (!VALID_ROLES.includes(role)) {
        usersRejected.push({ reason: `Invalid role '${u.role}'`, data: u });
        continue;
      }
      if (!VALID_USER_STATUS.includes(status)) {
        usersRejected.push({ reason: `Invalid status '${u.status}'`, data: u });
        continue;
      }
      if (usersSeen.has(userId)) {
        usersRejected.push({ reason: `Duplicate userId '${userId}'`, data: u });
        continue;
      }
      usersSeen.add(userId);
      usersValid.push({ userId, name, email, role, department, status });
    }

    const projectsValid = [];
    const projectsRejected = [];
    const projectsSeen = new Set();

    for (const p of raw.projects || []) {
      const projectId = p.projectId?.trim();
      const title = p.title?.trim();
      const description = p.description?.trim();
      const owner = p.owner?.trim();
      const status = p.status?.trim()?.toLowerCase() || "active";
      const startDate = p.startDate || p.startdate;

      if (!projectId || !title) {
        projectsRejected.push({ reason: "Missing required fields", data: p });
        continue;
      }
      if (!VALID_PROJECT_STATUS.includes(status)) {
        projectsRejected.push({ reason: `Invalid status '${p.status}'`, data: p });
        continue;
      }
      if (projectsSeen.has(projectId)) {
        projectsRejected.push({ reason: `Duplicate projectId '${projectId}'`, data: p });
        continue;
      }
      projectsSeen.add(projectId);

      const doc = { projectId, title, status };
      if (description) doc.description = description;
      if (owner) doc.owner = owner;
      if (p.members) doc.members = p.members;
      if (startDate && isValidDate(startDate)) doc.startDate = new Date(startDate);

      projectsValid.push(doc);
    }

    const validProjectIds = new Set(projectsValid.map(p => p.projectId));
    const validUserIds = new Set(usersValid.map(u => u.userId));

    const issuesValid = [];
    const issuesRejected = [];
    const issuesSeen = new Set();

    for (const i of raw.issues || []) {
      const issueId = i.issueId?.trim();
      const title = i.title?.trim();
      const projectId = i.projectId?.trim();
      const assignedTo = i.assignedTo?.trim();
      const reportedBy = i.reportedBy?.trim();
      const priority = i.priority?.trim()?.toLowerCase();
      const severity = i.severity?.trim()?.toLowerCase();
      const status = i.status?.trim()?.toLowerCase() || "open";
      const dueDate = i.dueDate;

      if (!issueId || !title) {
        issuesRejected.push({ reason: "Missing required fields", data: i });
        continue;
      }
      if (!VALID_PRIORITIES.includes(priority)) {
        issuesRejected.push({ reason: `Invalid priority '${i.priority}'`, data: i });
        continue;
      }
      if (severity && !VALID_SEVERITIES.includes(severity)) {
        issuesRejected.push({ reason: `Invalid severity '${i.severity}'`, data: i });
        continue;
      }
      if (!VALID_ISSUE_STATUS.includes(status)) {
        issuesRejected.push({ reason: `Invalid status '${i.status}'`, data: i });
        continue;
      }
      if (!validProjectIds.has(projectId)) {
        issuesRejected.push({ reason: `Invalid project reference '${projectId}'`, data: i });
        continue;
      }
      if (assignedTo && !validUserIds.has(assignedTo)) {
        issuesRejected.push({ reason: `Invalid assignedTo user '${assignedTo}'`, data: i });
        continue;
      }
      if (reportedBy && !validUserIds.has(reportedBy)) {
        issuesRejected.push({ reason: `Invalid reportedBy user '${reportedBy}'`, data: i });
        continue;
      }
      if (dueDate && !isValidDate(dueDate)) {
        issuesRejected.push({ reason: `Invalid dueDate '${dueDate}'`, data: i });
        continue;
      }
      if (issuesSeen.has(issueId)) {
        issuesRejected.push({ reason: `Duplicate issueId '${issueId}'`, data: i });
        continue;
      }
      issuesSeen.add(issueId);

      const doc = { issueId, title, projectId, priority, status };
      if (i.description) doc.description = i.description.trim();
      if (assignedTo) doc.assignedTo = assignedTo;
      if (reportedBy) doc.reportedBy = reportedBy;
      if (severity) doc.severity = severity;
      if (dueDate) doc.dueDate = new Date(dueDate);

      issuesValid.push(doc);
    }

    const validIssueIds = new Set(issuesValid.map(i => i.issueId));

    const commentsValid = [];
    const commentsRejected = [];
    const commentsSeen = new Set();

    for (const c of raw.comments || []) {
      const commentId = c.commentId?.trim();
      const issueId = c.issueId?.trim();
      const userId = c.userId?.trim();
      const message = c.message?.trim();
      const createdAt = c.createdAt;

      if (!commentId || !issueId || !userId) {
        commentsRejected.push({ reason: "Missing required fields", data: c });
        continue;
      }
      if (!message || message.length === 0) {
        commentsRejected.push({ reason: "Empty message", data: c });
        continue;
      }
      if (!validIssueIds.has(issueId)) {
        commentsRejected.push({ reason: `Invalid issue reference '${issueId}'`, data: c });
        continue;
      }
      if (!validUserIds.has(userId)) {
        commentsRejected.push({ reason: `Invalid user reference '${userId}'`, data: c });
        continue;
      }
      if (createdAt && !isValidDate(createdAt)) {
        commentsRejected.push({ reason: `Invalid date '${createdAt}'`, data: c });
        continue;
      }
      if (commentsSeen.has(commentId)) {
        commentsRejected.push({ reason: `Duplicate commentId '${commentId}'`, data: c });
        continue;
      }
      commentsSeen.add(commentId);

      const doc = { commentId, issueId, userId, message };
      if (createdAt) doc.createdAt = new Date(createdAt);

      commentsValid.push(doc);
    }

    const activitiesValid = [];
    const activitiesRejected = [];
    const activitiesSeen = new Set();

    for (const l of raw.activities_log || []) {
      const logId = l.logId?.trim();
      const issueId = l.issueId?.trim();
      const userId = l.userId?.trim();
      const action = l.action?.trim()?.toLowerCase();
      const previousStatus = l.previousStatus?.trim()?.toLowerCase() || null;
      const newStatus = l.newStatus?.trim()?.toLowerCase() || null;
      const timestamp = l.timestamp;

      if (!logId || !issueId) {
        activitiesRejected.push({ reason: "Missing required fields", data: l });
        continue;
      }
      if (!action) {
        activitiesRejected.push({ reason: "Missing action", data: l });
        continue;
      }
      if (!VALID_ACTIONS.includes(action)) {
        activitiesRejected.push({ reason: `Invalid action '${l.action}'`, data: l });
        continue;
      }
      if (!validIssueIds.has(issueId)) {
        activitiesRejected.push({ reason: `Invalid issue reference '${issueId}'`, data: l });
        continue;
      }
      if (userId && !validUserIds.has(userId)) {
        activitiesRejected.push({ reason: `Invalid user reference '${userId}'`, data: l });
        continue;
      }
      if (previousStatus && !VALID_ISSUE_STATUS.includes(previousStatus)) {
        activitiesRejected.push({ reason: `Invalid previousStatus '${l.previousStatus}'`, data: l });
        continue;
      }
      if (newStatus && !VALID_ISSUE_STATUS.includes(newStatus)) {
        activitiesRejected.push({ reason: `Invalid newStatus '${l.newStatus}'`, data: l });
        continue;
      }
      if (timestamp && !isValidDate(timestamp)) {
        activitiesRejected.push({ reason: `Invalid timestamp '${timestamp}'`, data: l });
        continue;
      }
      if (activitiesSeen.has(logId)) {
        activitiesRejected.push({ reason: `Duplicate logId '${logId}'`, data: l });
        continue;
      }
      activitiesSeen.add(logId);

      const doc = { logId, issueId, action };
      if (userId) doc.userId = userId;
      if (previousStatus) doc.previousStatus = previousStatus;
      if (newStatus) doc.newStatus = newStatus;
      if (timestamp) doc.timestamp = new Date(timestamp);

      activitiesValid.push(doc);
    }

    // 4. Save to Database using bulkWrite (upserts instead of clear-and-insert to preserve manually created records)
    let usersInserted = 0;
    let usersDuplicate = 0;
    
    if (usersValid.length > 0) {
      const ops = [];
      for (const u of usersValid) {
        const existing = await User.findOne({ userId: u.userId });
        if (existing) usersDuplicate++;
        else usersInserted++;
        
        const userHash = await hashPassword(u.userId);
        ops.push({
          updateOne: {
            filter: { userId: u.userId },
            update: { $set: { ...u, password: userHash } },
            upsert: true
          }
        });
      }
      await User.bulkWrite(ops);
    }

    let projectsInserted = 0;
    let projectsDuplicate = 0;
    
    if (projectsValid.length > 0) {
      const ops = [];
      for (const p of projectsValid) {
        const existing = await Project.findOne({ projectId: p.projectId });
        if (existing) projectsDuplicate++;
        else projectsInserted++;
        
        ops.push({
          updateOne: {
            filter: { projectId: p.projectId },
            update: { $set: p },
            upsert: true
          }
        });
      }
      await Project.bulkWrite(ops);
    }

    let issuesInserted = 0;
    let issuesDuplicate = 0;
    
    if (issuesValid.length > 0) {
      const ops = [];
      for (const i of issuesValid) {
        const existing = await Issue.findOne({ issueId: i.issueId });
        if (existing) issuesDuplicate++;
        else issuesInserted++;
        
        ops.push({
          updateOne: {
            filter: { issueId: i.issueId },
            update: { $set: i },
            upsert: true
          }
        });
      }
      await Issue.bulkWrite(ops);
    }

    let commentsInserted = 0;
    let commentsDuplicate = 0;
    
    if (commentsValid.length > 0) {
      const ops = [];
      for (const c of commentsValid) {
        const existing = await Comment.findOne({ commentId: c.commentId });
        if (existing) commentsDuplicate++;
        else commentsInserted++;
        
        ops.push({
          updateOne: {
            filter: { commentId: c.commentId },
            update: { $set: c },
            upsert: true
          }
        });
      }
      await Comment.bulkWrite(ops);
    }

    let activitiesInserted = 0;
    let activitiesDuplicate = 0;
    
    if (activitiesValid.length > 0) {
      const ops = [];
      for (const a of activitiesValid) {
        const existing = await ActivityLog.findOne({ logId: a.logId });
        if (existing) activitiesDuplicate++;
        else activitiesInserted++;
        
        ops.push({
          updateOne: {
            filter: { logId: a.logId },
            update: { $set: a },
            upsert: true
          }
        });
      }
      await ActivityLog.bulkWrite(ops);
    }

    const totalInserted = usersInserted + projectsInserted + issuesInserted + commentsInserted + activitiesInserted;
    const totalDuplicate = usersDuplicate + projectsDuplicate + issuesDuplicate + commentsDuplicate + activitiesDuplicate;
    const totalFetched = (raw.users?.length || 0) + (raw.projects?.length || 0) + (raw.issues?.length || 0) + (raw.comments?.length || 0) + (raw.activities_log?.length || 0);
    const totalRejected = usersRejected.length + projectsRejected.length + issuesRejected.length + commentsRejected.length + activitiesRejected.length;

    return res.status(200).json({
      success: true,
      message: "Dataset synchronized successfully",
      data: {
        totalFetched,
        inserted: totalInserted,
        duplicates: totalDuplicate,
        rejected: totalRejected
      }
    });
  } catch (error) {
    next(error);
  }
};
