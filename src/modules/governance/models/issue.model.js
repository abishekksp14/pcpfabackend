import mongoose from "mongoose";

const issueSchema = new mongoose.Schema(
  {
    issueId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    projectId: {
      type: String, // reference to Project.projectId
      required: true,
      trim: true,
    },
    assignedTo: {
      type: String, // reference to User.userId
      trim: true,
    },
    reportedBy: {
      type: String, // reference to User.userId
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      trim: true,
      lowercase: true,
    },
    severity: {
      type: String,
      enum: ["minor", "major", "critical", "blocker"],
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["open", "in-progress", "testing", "resolved", "closed"],
      default: "open",
      trim: true,
      lowercase: true,
    },
    dueDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Issue", issueSchema);
