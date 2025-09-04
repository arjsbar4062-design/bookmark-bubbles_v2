import seedBookmarks from "./seedBookmarks.js";

export default function resetBookmarks(db) {
  console.log("🗑️ Clearing old bookmarks...");
  db.prepare("DELETE FROM bookmarks").run();
  console.log("✅ Table cleared");
  seedBookmarks(db);
}
