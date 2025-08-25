// --- render tree ---
function renderTree(nodes, depth = 0, forceOpen = false) {
  const ul = document.createElement("ul");
  ul.style.listStyle = "none";
  ul.style.paddingLeft = depth ? "20px" : "0";

  nodes.forEach(node => {
    const li = document.createElement("li");
    const card = document.createElement("div");
    card.className = "bubble-card";

    if (node.type === "folder") {
      const span = document.createElement("span");
      span.textContent = "📂 " + node.title;
      span.style.cursor = "pointer";
      span.classList.add("bubble-label");

      const childContainer = renderTree(node.children || [], depth + 1, forceOpen);

      // If searching, auto-expand folders with children
      if (forceOpen && node.children && node.children.length > 0) {
        childContainer.style.display = "block";
      } else {
        childContainer.style.display = "none";
      }

      span.addEventListener("click", () => {
        childContainer.style.display =
          childContainer.style.display === "none" ? "block" : "none";
      });

      card.appendChild(span);

      const canEdit = currentRole === "owner";
      card.appendChild(makeButton("➕", async () => {
        const title = prompt("New bookmark title:");
        const url = prompt("Bookmark URL (leave empty for folder):");
        if (!title) return;
        const type = url ? "link" : "folder";
        await api("/bookmarks", {
          method: "POST",
          body: { parent_id: node.id, type, title, url },
        });
        loadBookmarks();
      }, canEdit));

      card.appendChild(makeButton("🗑️", async () => {
        if (!confirm("Delete this folder and its contents?")) return;
        await api("/bookmarks/" + node.id, { method: "DELETE" });
        loadBookmarks();
      }, canEdit));

      li.appendChild(card);
      li.appendChild(childContainer);

    } else {
      const a = document.createElement("a");
      a.href = node.url;
      a.textContent = "🔗 " + node.title;
      a.target = "_blank";
      a.classList.add("bubble-label");
      card.appendChild(a);

      const canEdit = currentRole === "owner";
      card.appendChild(makeButton("✏️", async () => {
        const newTitle = prompt("Edit title:", node.title);
        const newUrl = prompt("Edit URL:", node.url);
        if (!newTitle) return;
        await api("/bookmarks/" + node.id, {
          method: "PUT",
          body: { title: newTitle, url: newUrl },
        });
        loadBookmarks();
      }, canEdit));

      card.appendChild(makeButton("🗑️", async () => {
        if (!confirm("Delete this link?")) return;
        await api("/bookmarks/" + node.id, { method: "DELETE" });
        loadBookmarks();
      }, canEdit));

      li.appendChild(card);
    }

    ul.appendChild(li);
  });

  return ul;
}

// --- render based on search ---
function renderFilteredTree() {
  const query = searchInput.value;
  const filtered = filterTree(allBookmarks, query);
  treeContainer.innerHTML = "";
  // forceOpen = true when searching
  const tree = renderTree(filtered, 0, !!query);
  treeContainer.appendChild(tree);
}
