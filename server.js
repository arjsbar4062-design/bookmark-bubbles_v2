import express from "express";
import session from "cookie-session";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Database from "better-sqlite3";
import { JSDOM } from "jsdom";
import bcrypt from "bcrypt";

// routes
import authRoutes from "./routes/auth.js";
import bookmarkRoutes from "./routes/bookmarks.js";
import requestRoutes from "./routes/requests.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- Database setup ---
const db = new Database("./db/data.sqlite");
db.pragma("journal_mode = WAL");

// ensure settings table exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`).run();

// ensure bookmarks table exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    type TEXT,
    title TEXT,
    url TEXT,
    position INTEGER
  )
`).run();

// ensure requests table exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    user TEXT,
    message TEXT,
    created_at TEXT
  )
`).run();

// --- Seed hardcoded passwords if not present ---
function seedPasswords() {
  const ownerHash = db.prepare("SELECT value FROM settings WHERE key = 'owner_hash'").get();
  const guestHash = db.prepare("SELECT value FROM settings WHERE key = 'guest_hash'").get();

  if (!ownerHash) {
    const hash = bcrypt.hashSync("banana-owner", 10);
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("owner_hash", hash);
    console.log("✅ Seeded owner password");
  }
  if (!guestHash) {
    const hash = bcrypt.hashSync("guests-are-cool", 10);
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("guest_hash", hash);
    console.log("✅ Seeded guest password");
  }
}
seedPasswords();

// attach db to every request
app.use((req, res, next) => {
  req.db = db;
  next();
});

// middleware
app.use(express.json());
app.use(session({
  name: "session",
  keys: [process.env.SESSION_SECRET || "d71c"],
  maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
}));

// routes
app.use("/api", authRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/requests", requestRoutes);

// serve frontend
app.use(express.static(path.join(__dirname, "public")));

// --- Seed bookmarks from Stuff v8.html on first run ---
function seedBookmarks() {
  const count = db.prepare("SELECT COUNT(*) as c FROM bookmarks").get().c;
  if (count > 0) return; // already seeded

  console.log("📂 Seeding bookmarks from Stuff v8.html...");

  const htmlPath = path.join(__dirname, "db", "Stuff v8.html");
  if (!fs.existsSync(htmlPath)) {
    console.error("⚠️ Stuff v8.html not found in ./db/");
    return;
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const dom = new JSDOM(html);
  const dt = dom.window.document.querySelector("DL");

  function insertNode(node, parentId, position = 0) {
    if (!node) return;

    if (node.tagName === "DT") {
      const a = node.querySelector("a");
      const h3 = node.querySelector("h3");
      if (a) {
        db.prepare(`INSERT INTO bookmarks (id, parent_id, type, title, url, position)
                    VALUES (lower(hex(randomblob(16))), ?, 'link', ?, ?, ?)`)
          .run(parentId, a.textContent, a.href, position);
      } else if (h3) {
        const id = db.prepare(`SELECT lower(hex(randomblob(16))) as id`).get().id;
        db.prepare(`INSERT INTO bookmarks (id, parent_id, type, title, url, position)
                    VALUES (?, ?, 'folder', ?, NULL, ?)`)
          .run(id, parentId, h3.textContent, position);
        const dl = node.querySelector("DL");
        if (dl) {
          let i = 0;
          dl.childNodes.forEach(ch => {
            if (ch.tagName === "DT") {
              insertNode(ch, id, i++);
            }
          });
        }
      }
    }
  }

  let pos = 0;
  dt.childNodes.forEach(ch => {
    if (ch.tagName === "DT") {
      insertNode(ch, null, pos++);
    }
  });

  console.log("✅ Bookmarks seeded");
}

seedBookmarks();

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
