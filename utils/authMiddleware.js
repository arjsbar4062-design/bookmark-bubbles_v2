// utils/authMiddleware.js

export function requireOwner(req, res, next) {
  if (req.session?.role === "owner") {
    return next();
  }
  res.status(403).json({ error: "Forbidden" });
}

export function requireLogin(req, res, next) {
  if (req.session?.role) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}

