// Simple API helper
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

// Screen elements
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const logoutBtn = document.getElementById("logout");
const treeContainer = document.getElementById("bookmark-tree");

let currentRole = null;

// Render bookmark tree recursively
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
        childContainer.style.display = childContainer.style.display === "none" ? "block" : "none";
      });

      li.appendChild(span);
      li.appendChild(childContainer);
    } else {
      const a = document.createElement("a");
      a.href = node.url;
      a.textContent = "🔗 " + node.title;
      a.target = "_blank";
      a.classList.add("bubble");
      li.appendChild(a);
    }

    ul.appendChild(li);
  });
  return ul;
}

// Load bookmarks from backend
async function loadBookmarks() {
  try {
    const data = await api("/bookmarks");
    treeContainer.innerHTML = "";
    const tree = renderTree(data);
    treeContainer.appendChild(tree);
  } catch (err) {
    treeContainer.innerHTML = `<div class="error">⚠️ Failed to load bookmarks: ${err.message}</div>`;
  }
}

// Handle login form
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

// Logout
logoutBtn.addEventListener("click", async () => {
  await api("/logout", { method: "POST" });
  currentRole = null;
  appScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
});
