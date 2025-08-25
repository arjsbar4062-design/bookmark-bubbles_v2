import express from "express";
import cookieSession from "cookie-session";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import jsdom from "jsdom";

import authRoutes from "./routes/auth.js";
import bookmarkRoutes from "./routes/bookmarks.js";
import requestRoutes from "./routes/requests.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ session config that works on Render free
app.use(cookieSession({
  name: "session",
  keys: [process.env.SESSION_SECRET || "d71c"], // fallback to d71c
  sameSite: "lax",
  secure: false,
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000, // 1 day
}));

// --- database setup ---
const dbFile = path.join(__dirname, "db", "data.db");
const db = new Database(dbFile);

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  type TEXT,
  title TEXT,
  url TEXT,
  position INTEGER
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  role TEXT,
  created_at TEXT
);
`);

app.use((req, res, next) => {
  req.db = db;
  next();
});

// --- seed passwords ---
function setSetting(key, value) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)").run(key, value);
}

function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  return row?.value ?? null;
}

(async () => {
  if (!getSetting("owner_hash")) {
    const hash = await bcrypt.hash("banana-owner", 10);
    setSetting("owner_hash", hash);
    console.log("✅ Seeded owner password");
  }
  if (!getSetting("guest_hash")) {
    const hash = await bcrypt.hash("guests-are-cool", 10);
    setSetting("guest_hash", hash);
    console.log("✅ Seeded guest password");
  }
})();

// --- seed bookmarks from Stuff v8.html ---
import { JSDOM } from "jsdom";

function seedBookmarks() {
  const count = db.prepare("SELECT COUNT(*) as c FROM bookmarks").get().c;
  if (count > 0) return; // already seeded

  console.log("📂 Seeding bookmarks from Stuff v8.html...");

  const filePath = path.join(__dirname, "db", "Stuff v8.html");
  if (!fs.existsSync(filePath)) {
    console.error("❌ Missing Stuff v8.html, skipping bookmark seed.");
    return;
  }
  const html = fs.readFileSync(filePath, "utf-8");
  const dom = new JSDOM(html);
  const dtNodes = dom.window.document.querySelectorAll("DT");

  let pos = 0;
  dtNodes.forEach((dt) => {
    const a = dt.querySelector("a");
    const h3 = dt.querySelector("h3");
    if (a) {
      db.prepare("INSERT INTO bookmarks (id, parent_id, type, title, url, position) VALUES (?,?,?,?,?,?)")
        .run(Date.now().toString(36) + Math.random(), null, "link", a.textContent, a.href, pos++);
    } else if (h3) {
      db.prepare("INSERT INTO bookmarks (id, parent_id, type, title, url, position) VALUES (?,?,?,?,?,?)")
        .run(Date.now().toString(36) + Math.random(), null, "folder", h3.textContent, null, pos++);
    }
  });

  console.log("✅ Bookmarks seeded");
}
seedBookmarks();

// --- routes ---
app.use("/api", authRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/requests", requestRoutes);

// --- fallback ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
