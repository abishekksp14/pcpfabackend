import jwt from "jsonwebtoken";
import User from "../modules/identity/models/user.model.js";
import { ENV } from "../config/env.js";

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.status !== "active") {
      return res.status(401).json({ success: false, message: "Account disabled or inactive" });
    }

    if (user.isLocked()) {
      return res.status(403).json({ success: false, message: "Account locked" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

export { protect };
