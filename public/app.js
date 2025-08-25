// --- helper api ---
const api = async (path, options = {}) => {
  const res = await fetch("/api" + path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let msg = "Request failed";
    try { msg = (await res.json()).error; } catch {}
    throw new Error(msg);
  }
  return res.json();
};

// --- screen refs ---
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const logoutBtn = document.getElementById("logout");
const treeContainer = document.getElementById("bookmark-tree");

let currentRole = null;

// --- render tree ---
function renderTree(nodes, depth = 0) {
  const ul = document.createElement("ul");
  ul.style.listStyle = "none";
  ul.style.paddingLeft = depth ? "20px" : "0";

  nodes.forEach(node => {
    const li = document.createElement("li");
    li.style.margin = "5px 0";

    if (node.type === "folder") {
      const span = document.createElement("span");
      span.textContent = "📂 " + node.title;
      span.style.cursor = "pointer";
      span.classList.add("bubble");

      const childContainer = renderTree(node.children || [], depth + 1);
      childContainer.style.display = "none";

      span.addEventListener("click", () => {
        childContainer.style.display =
          childContainer.style.display === "none" ? "block" : "none";
      });

      li.appendChild(span);
      li.appendChild(childContainer);

      // owner buttons
      if (currentRole === "owner") {
        const addBtn = document.createElement("button");
        addBtn.textContent = "➕";
        addBtn.onclick = async () => {
          const title = prompt("New bookmark title:");
          const url = prompt("Bookmark URL (leave empty for folder):");
          if (!title) return;
          const type = url ? "link" : "folder";
          await api("/bookmarks", {
            method: "POST",
            body: { parent_id: node.id, type, title, url },
          });
          loadBookmarks();
        };
        li.appendChild(addBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = "🗑️";
        delBtn.onclick = async () => {
          if (!confirm("Delete this folder and its contents?")) return;
          await api("/bookmarks/" + node.id, { method: "DELETE" });
          loadBookmarks();
        };
        li.appendChild(delBtn);
      }
    } else {
      const a = document.createElement("a");
      a.href = node.url;
      a.textContent = "🔗 " + node.title;
      a.target = "_blank";
      a.classList.add("bubble");
      li.appendChild(a);

      // owner buttons
      if (currentRole === "owner") {
        const editBtn = document.createElement("button");
        editBtn.textContent = "✏️";
        editBtn.onclick = async () => {
          const newTitle = prompt("Edit title:", node.title);
          const newUrl = prompt("Edit URL:", node.url);
          if (!newTitle) return;
          await api("/bookmarks/" + node.id, {
            method: "PUT",
            body: { title: newTitle, url: newUrl },
          });
          loadBookmarks();
        };
        li.appendChild(editBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = "🗑️";
        delBtn.onclick = async () => {
          if (!confirm("Delete this link?")) return;
          await api("/bookmarks/" + node.id, { method: "DELETE" });
          loadBookmarks();
        };
        li.appendChild(delBtn);
      }
    }

    ul.appendChild(li);
  });
  return ul;
}

// --- load bookmarks ---
async function loadBookmarks() {
  try {
    const data = await api("/bookmarks");
    treeContainer.innerHTML = "";
    const tree = renderTree(Array.isArray(data) ? data : []);
    treeContainer.appendChild(tree);
  } catch (err) {
    treeContainer.innerHTML = `<div class="error">⚠️ Failed to load bookmarks: ${err.message}</div>`;
  }
}

// --- login form ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const role = document.getElementById("role").value;
  const password = document.getElementById("password").value;

  try {
    const res = await api("/login", {
      method: "POST",
      body: { role, password },
    });
    currentRole = res.role;
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    await loadBookmarks();
  } catch (err) {
    loginError.textContent = "❌ Login failed: " + err.message;
  }
});

// --- logout ---
logoutBtn.addEventListener("click", async () => {
  await api("/logout", { method: "POST" });
  currentRole = null;
  appScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
});
