import express from "express";
import { requireLogin, requireOwner } from "../utils/authMiddleware.js";
import { nanoid } from "nanoid";

const router = express.Router();

// --- Guest & owner can view their own requests ---
router.get("/", requireLogin, (req, res) => {
  const rows = req.db.prepare("SELECT * FROM requests ORDER BY created_at DESC").all();
  res.json(rows);
});

// --- Guest can create a request ---
router.post("/", requireLogin, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  const id = nanoid();
  const user = req.session.role;
  const created_at = new Date().toISOString();

  req.db.prepare(
    "INSERT INTO requests (id, user, message, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, user, message, created_at);

  res.json({ ok: true, id });
});

// --- Owner can delete a request ---
router.delete("/:id", requireOwner, (req, res) => {
  req.db.prepare("DELETE FROM requests WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
