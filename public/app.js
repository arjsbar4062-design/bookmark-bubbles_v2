let currentRole = null;
let allBookmarks = [];
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const treeContainer = document.getElementById("bookmark-tree");
const loginForm = document.getElementById("login-form");
const roleSelect = document.getElementById("role");
const passwordInput = document.getElementById("password");
const logoutBtn = document.getElementById("logout");
const searchInput = document.getElementById("search");
const ownerControls = document.getElementById("owner-controls");

// --- API helper ---
async function api(path, options = {}) {
  const res = await fetch("/api" + path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "include"
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    if (res.status === 403) showPopup("⛔ Owner only");
    throw new Error(msg);
  }
  return res.json();
}

// login
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const role = roleSelect.value;
    const password = passwordInput.value;
    const res = await api("/login", { method: "POST", body: { role, password } });
    currentRole = res.role;
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    ownerControls.style.display = currentRole === "owner" ? "block" : "none";
    loadBookmarks();
  } catch (err) {
    showPopup("❌ Login failed: " + err.message);
  }
});

// logout
logoutBtn.addEventListener("click", async () => {
  await api("/logout", { method: "POST" });
  currentRole = null;
  appScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
});

// reset button (owner only)
document.getElementById("reset-bookmarks").addEventListener("click", async () => {
  if (!confirm("Reset bookmarks from Stuff v8.html?")) return;
  await api("/reset-bookmarks", { method: "POST" });
  loadBookmarks();
  showPopup("🔄 Bookmarks reset from Stuff v8.html");
});

// popup
function showPopup(msg) {
  const popup = document.createElement("div");
  popup.className = "popup";
  popup.textContent = msg;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 3000);
}

// helper: make button
function makeButton(label, handler, show = true) {
  if (!show) return document.createElement("span");
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.addEventListener("click", handler);
  return btn;
}

// renderTree (same as before, expandable folders, new tab links)
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
      childContainer.style.display = forceOpen ? "block" : "none";

      span.addEventListener("click", () => {
        childContainer.style.display =
          childContainer.style.display === "none" ? "block" : "none";
      });

      card.appendChild(span);

      if (currentRole === "owner") {
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
        }));

        card.appendChild(makeButton("🗑️", async () => {
          if (!confirm("Delete this folder and its contents?")) return;
          await api("/bookmarks/" + node.id, { method: "DELETE" });
          loadBookmarks();
        }));
      }

      li.appendChild(card);
      li.appendChild(childContainer);

    } else {
      const a = document.createElement("a");
      a.href = node.url;
      a.textContent = "🔗 " + node.title;
      a.target = "_blank";
      a.classList.add("bubble-label");
      card.appendChild(a);

      if (currentRole === "owner") {
        card.appendChild(makeButton("✏️", async () => {
          const newTitle = prompt("Edit title:", node.title);
          const newUrl = prompt("Edit URL:", node.url);
          if (!newTitle) return;
          await api("/bookmarks/" + node.id, {
            method: "PUT",
            body: { title: newTitle, url: newUrl },
          });
          loadBookmarks();
        }));

        card.appendChild(makeButton("🗑️", async () => {
          if (!confirm("Delete this link?")) return;
          await api("/bookmarks/" + node.id, { method: "DELETE" });
          loadBookmarks();
        }));
      }

      li.appendChild(card);
    }

    ul.appendChild(li);
  });

  return ul;
}

// filter + render
function filterTree(nodes, query) {
  if (!query) return nodes;
  query = query.toLowerCase();
  return nodes.map(n => {
    if (n.type === "folder") {
      const kids = filterTree(n.children || [], query);
      if (n.title.toLowerCase().includes(query) || kids.length > 0) {
        return { ...n, children: kids };
      }
    } else if (n.title.toLowerCase().includes(query) || (n.url && n.url.toLowerCase().includes(query))) {
      return n;
    }
    return null;
  }).filter(Boolean);
}

async function loadBookmarks() {
  try {
    const data = await api("/bookmarks");
    allBookmarks = Array.isArray(data) ? data : [];
    renderFilteredTree();
  } catch (err) {
    treeContainer.innerHTML = `<div class="error">⚠️ Failed to load bookmarks: ${err.message}</div>`;
  }
}

function renderFilteredTree() {
  const query = searchInput.value;
  const filtered = filterTree(allBookmarks, query);
  treeContainer.innerHTML = "";
  treeContainer.appendChild(renderTree(filtered, 0, !!query));
}

searchInput.addEventListener("input", renderFilteredTree);
