import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";

export default function seedBookmarks(db) {
  const count = db.prepare("SELECT COUNT(*) as c FROM bookmarks").get().c;
  if (count > 0) return; // already seeded

  console.log("📂 Seeding bookmarks from Stuff v8.html...");

  const htmlPath = path.join(process.cwd(), "db", "Stuff v8.html");
  if (!fs.existsSync(htmlPath)) {
    console.error("⚠️ Stuff v8.html not found in ./db/");
    return;
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const dom = new JSDOM(html);
  const rootDL = dom.window.document.querySelector("DL");

  function insertDL(dl, parentId) {
    let position = 0;

    dl.querySelectorAll(":scope > DT").forEach(dt => {
      const a = dt.querySelector(":scope > A");
      const h3 = dt.querySelector(":scope > H3");

      if (a) {
        // bookmark link
        db.prepare(
          `INSERT INTO bookmarks (id, parent_id, type, title, url, position)
           VALUES (lower(hex(randomblob(16))), ?, 'link', ?, ?, ?)`
        ).run(parentId, a.textContent.trim(), a.href, position++);
      } else if (h3) {
        // folder
        const id = db.prepare("SELECT lower(hex(randomblob(16))) as id").get().id;
        db.prepare(
          `INSERT INTO bookmarks (id, parent_id, type, title, url, position)
           VALUES (?, ?, 'folder', ?, NULL, ?)`
        ).run(id, parentId, h3.textContent.trim(), position++);

        // recurse into child DL
        const childDL = dt.querySelector(":scope > DL");
        if (childDL) insertDL(childDL, id);
      }
    });
  }

  if (rootDL) insertDL(rootDL, null);

  console.log("✅ Bookmarks seeded successfully");
}
