import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    projectId: {
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
    owner: {
      type: String, // userId reference
      trim: true,
    },
    members: {
      type: [String], // array of userIds
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "completed", "archived"],
      default: "active",
      trim: true,
      lowercase: true,
    },
    startDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Project", projectSchema);
