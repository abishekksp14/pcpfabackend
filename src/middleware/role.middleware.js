export const hasRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const userRole = req.user.role ? req.user.role.toLowerCase() : "";
    const allowed = allowedRoles.map(r => r.toLowerCase());
    
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ success: false, message: "Access denied: Insufficient permissions" });
    }
    next();
  };
};
