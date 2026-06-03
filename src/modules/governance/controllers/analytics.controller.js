import Issue from "../models/issue.model.js";
import Project from "../models/project.model.js";
import User from "../../identity/models/user.model.js";
import ActivityLog from "../models/activityLog.model.js";

// Q15 - Issue Analytics
export const getIssueAnalytics = async (req, res, next) => {
  try {
    const total = await Issue.countDocuments();
    const open = await Issue.countDocuments({ status: "open" });
    const inProgress = await Issue.countDocuments({ status: "in-progress" });
    const testing = await Issue.countDocuments({ status: "testing" });
    const resolved = await Issue.countDocuments({ status: "resolved" });
    const closed = await Issue.countDocuments({ status: "closed" });

    return res.status(200).json({
      success: true,
      data: {
        totalIssues: total,
        openIssues: open,
        inProgressIssues: inProgress,
        testingIssues: testing,
        resolvedIssues: resolved,
        closedIssues: closed
      }
    });
  } catch (error) {
    next(error);
  }
};

// Q16 - Project Analytics
export const getProjectAnalytics = async (req, res, next) => {
  try {
    const activeProjectsCount = await Project.countDocuments({ status: "active" });
    const closedProjectsCount = await Project.countDocuments({
      status: { $in: ["completed", "archived", "inactive"] }
    });

    // Project-wise issue count
    const projectIssues = await Issue.aggregate([
      {
        $group: {
          _id: "$projectId",
          issueCount: { $sum: 1 }
        }
      }
    ]);

    // Hydrate project details
    const projectDetails = await Project.find({});
    const projectWiseIssueCount = projectDetails.map(p => {
      const match = projectIssues.find(pi => pi._id === p.projectId);
      return {
        projectId: p.projectId,
        title: p.title,
        status: p.status,
        issueCount: match ? match.issueCount : 0
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        activeProjectCount: activeProjectsCount,
        closedProjectCount: closedProjectsCount,
        projectWiseIssueCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// Q17 - Developer Analytics
export const getDeveloperAnalytics = async (req, res, next) => {
  try {
    // 1. Group resolved issues by assignedTo developer
    const resolvedByDev = await Issue.aggregate([
      { $match: { status: "resolved" } },
      {
        $group: {
          _id: "$assignedTo",
          resolvedCount: { $sum: 1 }
        }
      }
    ]);

    // Hydrate developer names
    const devsInfo = await User.find({ role: "developer" });

    const developerWiseResolved = devsInfo.map(d => {
      const match = resolvedByDev.find(r => r._id === d.userId);
      return {
        userId: d.userId,
        name: d.name,
        email: d.email,
        resolvedCount: match ? match.resolvedCount : 0
      };
    });

    // 2. Calculate average resolution time (in hours) using Activity Logs for resolved issues
    // We compare the timestamp of "resolved" action log with "created" action log for each issue.
    const resolvedLogs = await ActivityLog.find({ action: "resolved" });
    let totalDiffMs = 0;
    let countedIssues = 0;

    for (const log of resolvedLogs) {
      const createdLog = await ActivityLog.findOne({ issueId: log.issueId, action: "created" });
      if (createdLog && createdLog.timestamp && log.timestamp) {
        totalDiffMs += (new Date(log.timestamp) - new Date(createdLog.timestamp));
        countedIssues++;
      }
    }

    const averageResolutionTimeHours = countedIssues > 0
      ? parseFloat((totalDiffMs / (1000 * 60 * 60 * countedIssues)).toFixed(2))
      : 0;

    // 3. Find highest resolved issue count
    const highestResolvedCount = developerWiseResolved.length > 0
      ? Math.max(...developerWiseResolved.map(d => d.resolvedCount))
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        developerWiseResolved,
        averageResolutionTimeHours,
        highestResolvedIssueCount: highestResolvedCount
      }
    });
  } catch (error) {
    next(error);
  }
};
