import Comment from "../models/comment.model.js";
import Issue from "../models/issue.model.js";
import User from "../../identity/models/user.model.js";

const findCommentByIdOrCustom = async (id) => {
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    return await Comment.findById(id);
  }
  return await Comment.findOne({ commentId: id });
};

export const createComment = async (req, res, next) => {
  try {
    const { issueId, message, userId, commentId } = req.body;

    if (!issueId || !message) {
      return res.status(400).json({ success: false, message: "issueId and message are required" });
    }

    // Check issue exists
    const issue = await Issue.findOne({ issueId });
    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }

    const finalUserId = userId || req.user?.userId;
    if (!finalUserId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    // Check user exists
    const user = await User.findOne({ userId: finalUserId });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Auto-generate commentId
    let finalCommentId = commentId;
    if (!finalCommentId) {
      const count = await Comment.countDocuments();
      finalCommentId = `COM${1000 + count + 1}`;
    }

    const newComment = await Comment.create({
      commentId: finalCommentId,
      issueId,
      userId: finalUserId,
      message,
      createdAt: new Date()
    });

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: newComment
    });
  } catch (error) {
    next(error);
  }
};

export const getComments = async (req, res, next) => {
  try {
    const { issueId, search, page, limit } = req.query;
    const query = {};
    
    if (issueId) {
      query.issueId = issueId;
    }
    
    if (search) {
      query.message = { $regex: search, $options: "i" };
    }
    
    const total = await Comment.countDocuments(query);
    let comments;
    let responseObj = {
      success: true,
      message: "Data fetched successfully"
    };

    if (page || limit) {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const skip = (pageNum - 1) * limitNum;
      comments = await Comment.find(query).skip(skip).limit(limitNum);
      responseObj.page = pageNum;
      responseObj.limit = limitNum;
      responseObj.total = total;
      responseObj.totalPages = Math.ceil(total / limitNum);
    } else {
      comments = await Comment.find(query);
    }
    
    responseObj.data = comments;
    return res.status(200).json(responseObj);
  } catch (error) {
    next(error);
  }
};

export const getCommentById = async (req, res, next) => {
  try {
    const comment = await findCommentByIdOrCustom(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Comment fetched successfully",
      data: comment
    });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    const comment = await findCommentByIdOrCustom(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }
    await Comment.deleteOne({ _id: comment._id });
    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};
