import Issue from "../models/issue.model.js";
import User from "../../identity/models/user.model.js";
import Project from "../models/project.model.js";
import ActivityLog from "../models/activityLog.model.js";

const findIssueByIdOrCustom = async (id) => {
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    return await Issue.findById(id);
  }
  return await Issue.findOne({ issueId: id });
};

// Log activity helper
const logActivity = async (issueId, userId, action, previousStatus, newStatus) => {
  try {
    const count = await ActivityLog.countDocuments();
    const logId = `LOG${1000 + count + 1}`;
    await ActivityLog.create({
      logId,
      issueId,
      userId,
      action,
      previousStatus,
      newStatus,
      timestamp: new Date()
    });
  } catch (err) {
    console.error("Failed to log activity:", err.message);
  }
};

export const createIssue = async (req, res, next) => {
  try {
    const { title, description, projectId, assignedTo, reportedBy, priority, severity, status, dueDate, issueId } = req.body;

    if (!title || !projectId || !priority) {
      return res.status(400).json({ success: false, message: "Title, projectId, and priority are required" });
    }

    // Check project exists
    const project = await Project.findOne({ projectId });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    // Check users exist
    if (assignedTo) {
      const devUser = await User.findOne({ userId: assignedTo });
      if (!devUser) return res.status(404).json({ success: false, message: "Assigned user not found" });
    }
    if (reportedBy) {
      const reporterUser = await User.findOne({ userId: reportedBy });
      if (!reporterUser) return res.status(404).json({ success: false, message: "ReportedBy user not found" });
    }

    // Auto-generate issueId
    let finalIssueId = issueId;
    if (!finalIssueId) {
      const count = await Issue.countDocuments();
      finalIssueId = `ISS${1000 + count + 1}`;
    }

    const newIssue = await Issue.create({
      issueId: finalIssueId,
      title,
      description,
      projectId,
      assignedTo,
      reportedBy,
      priority: priority.toLowerCase(),
      severity: severity ? severity.toLowerCase() : undefined,
      status: status ? status.toLowerCase() : "open",
      dueDate: dueDate ? new Date(dueDate) : undefined
    });

    // Create activity log
    await logActivity(newIssue.issueId, req.user?.userId || reportedBy, "created", null, newIssue.status);

    return res.status(201).json({
      success: true,
      message: "Issue created successfully",
      data: newIssue
    });
  } catch (error) {
    next(error);
  }
};

export const getIssues = async (req, res, next) => {
  try {
    const { priority, status, severity, search, page, limit } = req.query;
    const query = {};

    if (priority) query.priority = priority.toLowerCase();
    if (status) query.status = status.toLowerCase();
    if (severity) query.severity = severity.toLowerCase();

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { issueId: { $regex: search, $options: "i" } }
      ];
    }

    const total = await Issue.countDocuments(query);
    let issues;
    let responseObj = {
      success: true,
      message: "Data fetched successfully"
    };

    if (page || limit) {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const skip = (pageNum - 1) * limitNum;
      issues = await Issue.find(query).skip(skip).limit(limitNum);
      responseObj.page = pageNum;
      responseObj.limit = limitNum;
      responseObj.total = total;
      responseObj.totalPages = Math.ceil(total / limitNum);
    } else {
      issues = await Issue.find(query);
    }

    responseObj.data = issues;
    return res.status(200).json(responseObj);
  } catch (error) {
    next(error);
  }
};

export const getIssueById = async (req, res, next) => {
  try {
    const issue = await findIssueByIdOrCustom(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Issue fetched successfully",
      data: issue
    });
  } catch (error) {
    next(error);
  }
};

export const updateIssue = async (req, res, next) => {
  try {
    const issue = await findIssueByIdOrCustom(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }

    // Role-based Access Control (RBAC) validations:
    // 1. Testers cannot edit issue details.
    if (req.user?.role === "tester") {
      return res.status(403).json({
        success: false,
        message: "Testers cannot edit issue details (they can only report issues and add comments)"
      });
    }

    // 2. Developers can only edit/update issues assigned to them.
    if (req.user?.role === "developer" && issue.assignedTo !== req.user?.userId) {
      return res.status(403).json({
        success: false,
        message: "Developers can only update their assigned issues"
      });
    }

    // 3. Only Admin and Manager can change issue priority.
    if (req.body.priority !== undefined && req.user?.role !== "admin" && req.user?.role !== "manager") {
      return res.status(403).json({
        success: false,
        message: "Only admin and manager can change issue priority"
      });
    }

    // Rule: "resolved issue cannot be edited directly"
    // Block general edits to details, but allow updates if status is changed inside the same call.
    if (issue.status === "resolved" && !req.body.status) {
      return res.status(400).json({
        success: false,
        message: "Resolved issues cannot be edited directly. Please change the status first."
      });
    }

    // Rule: "closed issue cannot move without reopen"
    if (issue.status === "closed" && req.body.status && req.body.status !== "open" && req.body.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: "Closed issues cannot move without reopening (status must be set to open or in-progress)."
      });
    }

    const previousStatus = issue.status;

    // Apply allowed updates
    const allowedUpdates = ["title", "description", "priority", "severity", "dueDate"];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === "dueDate" && req.body[field]) {
          issue.dueDate = new Date(req.body[field]);
        } else if (field === "priority" || field === "severity") {
          issue[field] = req.body[field].toLowerCase();
        } else {
          issue[field] = req.body[field];
        }
      }
    });

    if (req.body.status) {
      const newStatus = req.body.status.toLowerCase();
      // Apply status validation rules
      if (newStatus === "testing" && req.user?.role === "developer" && issue.assignedTo !== req.user?.userId) {
        return res.status(403).json({
          success: false,
          message: "Only the assigned developer can move this issue to testing"
        });
      }
      if (newStatus === "closed" && req.user?.role === "tester") {
        return res.status(403).json({
          success: false,
          message: "Testers cannot close issues directly"
        });
      }
      issue.status = newStatus;
      await logActivity(issue.issueId, req.user?.userId || "system", "status_changed", previousStatus, newStatus);
    }

    await issue.save();

    return res.status(200).json({
      success: true,
      message: "Issue updated successfully",
      data: issue
    });
  } catch (error) {
    next(error);
  }
};

export const deleteIssue = async (req, res, next) => {
  try {
    const issue = await findIssueByIdOrCustom(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }
    await Issue.deleteOne({ _id: issue._id });
    return res.status(200).json({
      success: true,
      message: "Issue deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

// Q10 - Assign issue
export const assignIssue = async (req, res, next) => {
  try {
    const issue = await findIssueByIdOrCustom(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }

    // Rule: "closed issue cannot be assigned"
    if (issue.status === "closed") {
      return res.status(400).json({ success: false, message: "Closed issue cannot be assigned" });
    }

    const { assignedTo } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ success: false, message: "assignedTo user id is required" });
    }

    // Rule: "assigned user must exist"
    const user = await User.findOne({ userId: assignedTo });
    if (!user) {
      return res.status(404).json({ success: false, message: "Assigned user does not exist" });
    }

    issue.assignedTo = assignedTo;
    await issue.save();

    // Log the assign activity
    await logActivity(issue.issueId, req.user?.userId || "system", "assigned", issue.status, issue.status);

    return res.status(200).json({
      success: true,
      message: "Issue assigned successfully",
      data: issue
    });
  } catch (error) {
    next(error);
  }
};

// Q11 - Update status
export const updateIssueStatus = async (req, res, next) => {
  try {
    const issue = await findIssueByIdOrCustom(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const newStatus = status.toLowerCase();
    const previousStatus = issue.status;

    // Role-based status change authorization:
    if (req.user?.role === "tester") {
      return res.status(403).json({
        success: false,
        message: "Testers cannot change issue status"
      });
    }

    if (req.user?.role === "developer" && issue.assignedTo !== req.user?.userId) {
      return res.status(403).json({
        success: false,
        message: "Developers can only change status of their assigned issues"
      });
    }

    // Allowed status list
    const allowed = ["open", "in-progress", "testing", "resolved", "closed"];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    // Rule: "closed issue cannot move without reopen"
    if (previousStatus === "closed" && newStatus !== "open" && newStatus !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: "Closed issues cannot move without reopening (status must be open or in-progress)"
      });
    }

    // Rule: "Testers cannot close issues directly"
    if (newStatus === "closed" && req.user?.role === "tester") {
      return res.status(403).json({
        success: false,
        message: "Testers cannot close issues directly"
      });
    }

    // Rule: "only assigned developers can move issues to testing"
    if (newStatus === "testing" && req.user?.role === "developer" && issue.assignedTo !== req.user?.userId) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned developer can move this issue to testing"
      });
    }

    issue.status = newStatus;
    await issue.save();

    await logActivity(issue.issueId, req.user?.userId || "system", "status_changed", previousStatus, newStatus);

    return res.status(200).json({
      success: true,
      message: "Issue status updated successfully",
      data: issue
    });
  } catch (error) {
    next(error);
  }
};
