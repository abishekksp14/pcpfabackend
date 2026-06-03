import mongoose from "mongoose";

export const getHealth = async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    
    // Count documents across all collections
    const collections = ['users', 'projects', 'issues', 'comments', 'activitylogs'];
    let documentCount = 0;
    
    if (dbStatus === "connected") {
      for (const collName of collections) {
        try {
          const count = await mongoose.connection.db.collection(collName).countDocuments();
          documentCount += count;
        } catch (e) {
          // Collection might not exist yet
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      message: "Database connected successfully",
      data: {
        database: dbStatus,
        documentCount: documentCount
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Health check failed"
    });
  }
};
