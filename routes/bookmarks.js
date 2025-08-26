import express from "express";
import { requireLogin, requireOwner } from "../utils/authMiddleware.js";
import { nanoid } from "nanoid";

const router = express.Router();

// --- Get all bookmarks (any logged in user) ---
router.get("/", requireLogin, (req, res) => {
  const rows = req.db.prepare("SELECT * FROM bookmarks ORDER BY position").all();
  res.json(buildTree(rows));
});

// --- Add bookmark/folder (owner only) ---
router.post("/", requireOwner, (req, res) => {
  const { parent_id, type, title, url } = req.body;
  const id = nanoid();
  const position = req.db.prepare("SELECT COUNT(*) as c FROM bookmarks WHERE parent_id IS ?").get(parent_id || null).c;
  req.db.prepare(
    `INSERT INTO bookmarks (id, parent_id, type, title, url, position)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, parent_id || null, type, title, url || null, position);
  res.json({ ok: true, id });
});

// --- Update bookmark (owner only) ---
router.put("/:id", requireOwner, (req, res) => {
  const { title, url } = req.body;
  req.db.prepare(
    `UPDATE bookmarks SET title = ?, url = ? WHERE id = ?`
  ).run(title, url, req.params.id);
  res.json({ ok: true });
});

// --- Delete bookmark/folder (owner only) ---
router.delete("/:id", requireOwner, (req, res) => {
  const id = req.params.id;
  req.db.prepare("DELETE FROM bookmarks WHERE id = ? OR parent_id = ?").run(id, id);
  res.json({ ok: true });
});

// --- Helper: build nested tree ---
function buildTree(rows) {
  const map = {};
  const roots = [];
  rows.forEach(r => {
    map[r.id] = { ...r, children: [] };
  });
  rows.forEach(r => {
    if (r.parent_id && map[r.parent_id]) {
      map[r.parent_id].children.push(map[r.id]);
    } else {
      roots.push(map[r.id]);
    }
  });
  return roots;
}

export default router;
