import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    logId: {
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
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    previousStatus: {
      type: String,
      trim: true,
      lowercase: true,
    },
    newStatus: {
      type: String,
      trim: true,
      lowercase: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("ActivityLog", activityLogSchema);
