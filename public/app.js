// ===== Elements =====
const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const appScreen = document.getElementById("app-screen");
const logoutBtn = document.getElementById("logout");
const searchInput = document.getElementById("search");
const ownerControls = document.getElementById("owner-controls");
const treeContainer = document.getElementById("bookmark-tree");
const popupContainer = document.getElementById("popup-container");

// ===== Helpers =====
function showPopup(msg) {
  const div = document.createElement("div");
  div.className = "popup";
  div.textContent = msg;
  popupContainer.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ===== Render tree =====
function renderTree(nodes, parentEl) {
  if (!Array.isArray(nodes)) return;
  const ul = document.createElement("ul");

  nodes.forEach((node) => {
    const li = document.createElement("li");

    if (node.type === "folder") {
      const bubble = document.createElement("div");
      bubble.className = "bubble-card";

      const label = document.createElement("span");
      label.className = "bubble-label";
      label.textContent = `📂 ${node.title}`;
      bubble.appendChild(label);

      // Expand/collapse
      const childrenContainer = document.createElement("div");
      childrenContainer.style.marginLeft = "20px";
      childrenContainer.style.display = "none";

      label.addEventListener("click", () => {
        childrenContainer.style.display =
          childrenContainer.style.display === "none" ? "block" : "none";
      });

      li.appendChild(bubble);
      li.appendChild(childrenContainer);
      renderTree(node.children, childrenContainer);
    } else if (node.type === "bookmark") {
      const bubble = document.createElement("a");
      bubble.className = "bubble-card bubble-label";
      bubble.href = node.url;
      bubble.target = "_blank";
      bubble.textContent = `🔗 ${node.title}`;
      li.appendChild(bubble);
    }

    ul.appendChild(li);
  });

  parentEl.appendChild(ul);
}

async function loadBookmarks() {
  treeContainer.innerHTML = "";
  try {
    const data = await api("/bookmarks");
    renderTree(data, treeContainer);
  } catch (err) {
    showPopup("Failed to load bookmarks");
    console.error(err);
  }
}

// ===== Auth =====
async function checkAuth() {
  try {
    const data = await api("/auth/me");
    if (data.role) {
      loginScreen.classList.add("hidden");
      appScreen.classList.remove("hidden");
      if (data.role === "owner") {
        ownerControls.classList.remove("hidden");
      } else {
        ownerControls.classList.add("hidden");
      }
      loadBookmarks();
    }
  } catch (err) {
    console.log("Not logged in");
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const role = document.getElementById("role").value;
  const password = document.getElementById("password").value;

  try {
    await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ role, password }),
    });
    showPopup("Logged in");
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    if (role === "owner") {
      ownerControls.classList.remove("hidden");
    } else {
      ownerControls.classList.add("hidden");
    }
    loadBookmarks();
  } catch (err) {
    showPopup("Login failed");
    console.error(err);
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
    showPopup("Logged out");
    appScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  } catch (err) {
    console.error(err);
  }
});

// ===== Search =====
searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  const links = treeContainer.querySelectorAll(".bubble-label");
  links.forEach((link) => {
    const text = link.textContent.toLowerCase();
    link.closest("li").style.display = text.includes(query) ? "" : "none";
  });
});

// ===== Init =====
checkAuth();
