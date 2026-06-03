import User from "../../identity/models/user.model.js";

// Helper to query user by _id (if valid ObjectId) or by custom userId
const findUserByIdOrCustom = async (id) => {
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    return await User.findById(id);
  }
  return await User.findOne({ userId: id });
};

export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password -refreshToken');
    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await findUserByIdOrCustom(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user
    });
  } catch (error) {
    next(error);
  }
};
