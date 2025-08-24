import express from "express";
import { requireRole, requireAny } from "../utils/authMiddleware.js";

const router = express.Router();

// Helper: build tree from flat rows
function buildTree(rows) {
  const map = {};
  rows.forEach(r => {
    map[r.id] = { ...r, children: [] };
  });
  const tree = [];
  rows.forEach(r => {
    if (r.parent_id && map[r.parent_id]) {
      map[r.parent_id].children.push(map[r.id]);
    } else {
      tree.push(map[r.id]);
    }
  });
  return tree;
}

// 📂 Get bookmark tree (guest + owner)
router.get("/", requireAny(["guest", "owner"]), (req, res) => {
  const rows = req.db.prepare(
    "SELECT id, parent_id, type, title, url, position FROM bookmarks ORDER BY position"
  ).all();
  res.json(buildTree(rows)); // ✅ always array
});

// ➕ Add bookmark (owner only)
router.post("/", requireRole("owner"), (req, res) => {
  const { parent_id, type, title, url, position } = req.body;
  if (!type || !title) {
    return res.status(400).json({ error: "type and title required" });
  }
  const id = Date.now().toString(36); // simple ID
  req.db.prepare(
    "INSERT INTO bookmarks (id, parent_id, type, title, url, position) VALUES (?,?,?,?,?,?)"
  ).run(id, parent_id || null, type, title, url || null, position || 0);
  res.json({ ok: true, id });
});

// ✏️ Edit bookmark (owner only)
router.put("/:id", requireRole("owner"), (req, res) => {
  const { title, url } = req.body;
  req.db.prepare(
    "UPDATE bookmarks SET title = ?, url = ? WHERE id = ?"
  ).run(title, url, req.params.id);
  res.json({ ok: true });
});

// 🗑️ Delete bookmark (owner only)
router.delete("/:id", requireRole("owner"), (req, res) => {
  req.db.prepare("DELETE FROM bookmarks WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// 📤 Export bookmarks (guest + owner)
router.get("/export", requireAny(["guest", "owner"]), (req, res) => {
  const rows = req.db.prepare(
    "SELECT id, parent_id, type, title, url, position FROM bookmarks ORDER BY position"
  ).all();
  res.json(buildTree(rows));
});

export default router;
