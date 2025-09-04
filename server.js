import express from "express";
import session from "cookie-session";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";

import authRoutes from "./routes/auth.js";
import bookmarkRoutes from "./routes/bookmarks.js";
import requestRoutes from "./routes/requests.js";

import seedBookmarks from "./utils/seedBookmarks.js";
import resetBookmarks from "./utils/resetBookmarks.js";
import { requireOwner } from "./utils/authMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- Database setup ---
const db = new Database("./db/data.sqlite");
db.pragma("journal_mode = WAL");

db.prepare(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`).run();

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

db.prepare(`
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    user TEXT,
    message TEXT,
    created_at TEXT
  )
`).run();

// --- Seed hardcoded passwords ---
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

// attach db
app.use((req, res, next) => {
  req.db = db;
  next();
});

// middleware
app.set("trust proxy", 1);
app.use(express.json());
app.use(session({
  name: "session",
  keys: [process.env.SESSION_SECRET || "d71c"],
  maxAge: 7 * 24 * 60 * 60 * 1000,
}));

// routes
app.use("/api", authRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/requests", requestRoutes);

// reset route (owner only)
app.post("/api/reset-bookmarks", requireOwner, (req, res) => {
  resetBookmarks(db);
  res.json({ ok: true });
});

// serve frontend
app.use(express.static(path.join(__dirname, "public")));

// seed bookmarks if empty
seedBookmarks(db);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
