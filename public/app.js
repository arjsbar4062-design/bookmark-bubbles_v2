async function api(path, options = {}) {
  const res = await fetch("/api" + path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function refreshBookmarks() {
  const data = await api("/bookmarks");
  const tree = document.getElementById("bookmark-tree");
  tree.innerHTML = "";
  renderNode(data.root, tree);
}

function renderNode(node, parentEl) {
  if (node.type === "folder" || node.title === "Root") {
    const div = document.createElement("div");
    div.className = "bubble folder";
    div.textContent = node.title;
    parentEl.appendChild(div);

    if (node.children) {
      const childContainer = document.createElement("div");
      childContainer.style.marginLeft = "20px";
      parentEl.appendChild(childContainer);
      node.children.forEach(ch => renderNode(ch, childContainer));
    }
  } else {
    const div = document.createElement("a");
    div.className = "bubble link";
    div.href = node.url;
    div.textContent = node.title;
    div.target = "_blank";
    parentEl.appendChild(div);
  }
}

document.getElementById("login-btn").onclick = async () => {
  const role = document.getElementById("role").value;
  const password = document.getElementById("password").value;
  try {
    await api("/login", { method: "POST", body: { role, password } });
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    setupRole(role);
    refreshBookmarks();
  } catch (e) {
    document.getElementById("login-error").textContent = "❌ Login failed";
  }
};

document.getElementById("logout-btn").onclick = async () => {
  await api("/logout", { method: "POST" });
  location.reload();
};

document.getElementById("export-btn").onclick = async () => {
  const res = await fetch("/api/bookmarks/export", { method: "POST" });
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bookmarks.json";
  a.click();
};

document.getElementById("import-btn").onclick = () => {
  document.getElementById("import-file").click();
};

document.getElementById("import-file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  // TODO: send to backend to import (can add later)
  alert("Import not fully implemented yet");
};

document.getElementById("request-btn").onclick = async () => {
  const msg = prompt("Enter your request message:");
  if (msg) {
    await api("/requests", { method: "POST", body: { message: msg } });
    alert("Request sent!");
  }
};

function setupRole(role) {
  if (role === "owner") {
    document.querySelectorAll(".owner-only").forEach(el => el.style.display = "inline-block");
    document.querySelectorAll(".guest-only").forEach(el => el.style.display = "none");
  } else {
    document.querySelectorAll(".owner-only").forEach(el => el.style.display = "none");
    document.querySelectorAll(".guest-only").forEach(el => el.style.display = "inline-block");
  }
}
