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

// --- API helper with session cookies ---
async function api(path, options = {}) {
  const res = await fetch("/api" + path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "include"   // 🔑 ensures cookies are sent
  });

  if (!res.ok) {
    let msg = res.statusText;
    try { 
      const data = await res.json();
      msg = data.error || msg;
    } catch {}
    if (res.status === 403) {
      showPopup("⛔ You don’t have permission (owner only).");
    }
    throw new Error(msg);
  }
  return res.json();
}

// --- login ---
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const role = roleSelect.value;
    const password = passwordInput.value;
    const res = await api("/login", {
      method: "POST",
      body: { role, password }
    });
    currentRole = res.role;
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    loadBookmarks();
  } catch (err) {
    showPopup("❌ Login failed: " + err.message);
  }
});

// --- logout ---
logoutBtn.addEventListener("click", async () => {
  await api("/logout", { method: "POST" });
  currentRole = null;
  appScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
});

// --- popup helper ---
function showPopup(msg) {
  const popup = document.createElement("div");
  popup.className = "popup";
  popup.textContent = msg;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 3000);
}

// --- make button ---
function makeButton(label, handler, show = true) {
  if (!show) return document.createElement("span");
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.addEventListener("click", handler);
  return btn;
}

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

// --- filter tree ---
function filterTree(nodes, query) {
  if (!query) return nodes;
  query = query.toLowerCase();

  return nodes
    .map(node => {
      if (node.type === "folder") {
        const filteredChildren = filterTree(node.children || [], query);
        if (node.title.toLowerCase().includes(query) || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
      } else {
        if (node.title.toLowerCase().includes(query) || (node.url && node.url.toLowerCase().includes(query))) {
          return node;
        }
      }
      return null;
    })
    .filter(n => n);
}

// --- load bookmarks ---
async function loadBookmarks() {
  try {
    const data = await api("/bookmarks");
    allBookmarks = Array.isArray(data) ? data : [];
    renderFilteredTree();
  } catch (err) {
    treeContainer.innerHTML =
      `<div class="error">⚠️ Failed to load bookmarks: ${err.message}</div>`;
  }
}

// --- render based on search ---
function renderFilteredTree() {
  const query = searchInput.value;
  const filtered = filterTree(allBookmarks, query);
  treeContainer.innerHTML = "";
  const tree = renderTree(filtered, 0, !!query);
  treeContainer.appendChild(tree);
}

// --- search input listener ---
searchInput.addEventListener("input", renderFilteredTree);
