import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    commentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    issueId: {
      type: String, // reference to Issue.issueId
      required: true,
      trim: true,
    },
    userId: {
      type: String, // reference to User.userId
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Comment", commentSchema);
