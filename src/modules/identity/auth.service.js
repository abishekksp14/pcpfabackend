import AppError from "../../utils/appError.util.js";
import asyncHandler from "../../utils/asyncHandler.util.js";
import User from "./models/user.model.js";
import { hashPassword, comparePassword } from "../../utils/password.util.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.utils.js";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000;

export const register = asyncHandler(async ({ name, email, password, role, department, status, userId }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("Email already in use", 400);
  }

  // Validate role
  const normalizedRole = role ? role.toLowerCase() : "developer";
  const validRoles = ["admin", "manager", "developer", "tester"];
  if (!validRoles.includes(normalizedRole)) {
    throw new AppError("Invalid role", 400);
  }

  const hashedPassword = await hashPassword(password);

  // Auto-generate userId if not provided
  let finalUserId = userId;
  if (!finalUserId) {
    const count = await User.countDocuments();
    finalUserId = `USR${1000 + count + 1}`;
  }

  const user = await User.create({
    userId: finalUserId,
    name,
    email,
    password: hashedPassword,
    role: normalizedRole,
    department: department || "Development",
    status: status || "active",
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save();

  return { user, accessToken, refreshToken };
});

export const login = asyncHandler(async (emailOrName, password) => {
  const user = await User.findOne({
    $or: [
      { email: emailOrName },
      { name: emailOrName },
      { userId: emailOrName }
    ]
  }).select("+password");

  if (!user) throw new AppError("Invalid credentials", 400);

  if (user.status === "inactive") {
    throw new AppError("Account disabled", 403);
  }

  if (user.isLocked()) {
    throw new AppError("Account locked. Try later.", 403);
  }

  const isMatch = await comparePassword(password, user.password);

  if (!isMatch) {
    user.loginAttempts += 1;

    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = Date.now() + LOCK_TIME;
    }

    await user.save();
    throw new AppError("Invalid credentials", 400);
  }

  // Successful login
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save();

  return { user, accessToken, refreshToken };
});

export const refreshAccessToken = asyncHandler(async (token) => {
  if (!token) throw new AppError("No refresh token", 401);

  const decoded = verifyRefreshToken(token);

  const user = await User.findById(decoded.id);
  if (!user || user.refreshToken !== token) {
    throw new AppError("Invalid refresh token", 401);
  }

  return generateAccessToken(user);
});

export const logout = asyncHandler(async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
});
