import express from 'express';
import cookieSession from 'cookie-session';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import authRoutes from './routes/auth.js';
import bookmarkRoutes from './routes/bookmarks.js';
import requestRoutes from './routes/requests.js';
import { seedBookmarks } from './utils/seedBookmarks.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(cookieSession({
  name: 'sess',
  keys: ['d71c'],   // ✅ your session secret key
  httpOnly: true,
  sameSite: 'lax'
}));

// ✅ use ./data folder so it works free on Render
const DB_PATH = './data/app.db';
fs.mkdirSync('./data', { recursive: true });
const db = new Database(DB_PATH);

// init DB schema
const initSql = fs.readFileSync('./db/init.sql','utf-8');
db.exec(initSql);

// seed passwords (hardcoded now)
function getSetting(key){
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value ?? null;
}
function setSetting(key, value){
  db.prepare(
    'INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  ).run(key, value);
}
async function ensurePasswordHashes(){
  let ownerHash = getSetting('owner_hash');
  let guestHash = getSetting('guest_hash');
  if (!ownerHash || !guestHash){
    const ownerPlain = "banana-owner";
    const guestPlain = "guests-are-cool";
    ownerHash = await bcrypt.hash(ownerPlain, 10);
    guestHash = await bcrypt.hash(guestPlain, 10);
    setSetting('owner_hash', ownerHash);
    setSetting('guest_hash', guestHash);
    console.log("✅ Seeded hardcoded passwords");
  }
}
await ensurePasswordHashes();

// ✅ seed bookmarks from Stuff v8.html if DB empty
const count = db.prepare("SELECT COUNT(*) as c FROM bookmarks").get().c;
if (count === 0) {
  console.log("📂 Seeding bookmarks from Stuff v8.html...");
  const html = fs.readFileSync("./db/Stuff v8.html", "utf-8");
  await seedBookmarks(db, html);
  console.log("✅ Bookmarks seeded");
}

// attach db to req
app.use((req,res,next)=>{ req.db = db; next(); });

app.use(express.static('public'));
app.use('/api', authRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/requests', requestRoutes);

// fallback to SPA
app.get('*', (req,res)=>{
  res.sendFile(path.resolve('public/index.html'));
});

app.listen(PORT, ()=>{
  console.log(`🔮 Bookmark Bubbles running on http://localhost:${PORT}`);
});
