import { successResponse } from "../../utils/response.util.js";
import * as authService from "./auth.service.js";

export const register = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.register(req.body);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.login(
      req.body.email || req.body.username || req.body.name,
      req.body.password
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: accessToken,
      data: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    const accessToken = await authService.refreshAccessToken(token);

    return res.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
      data: { accessToken }
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  const user = req.user;
  return res.status(200).json({
    success: true,
    message: "User fetched successfully",
    data: {
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      status: user.status
    }
  });
};

export const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await authService.logout(req.user._id);
    }
    res.clearCookie("refreshToken");
    return res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    next(error);
  }
};

export const adminLogin = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.login(
      req.body.email || req.body.username || req.body.name,
      req.body.password
    );

    if (user.role !== "admin" && user.role !== "manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Only admins and managers are allowed to log in here."
      });
    }

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: accessToken,
      data: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
};
