// ─────────────────────────────────────────────
//  FIREBASE CONFIG  ← Replace with your values
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCk-eNmAk8IkPmdYJOYBbQQ3e1qVj5OL90",
  authDomain: "bazaar-list-1727e.firebaseapp.com",
  projectId: "bazaar-list-1727e",
  storageBucket: "bazaar-list-1727e.firebasestorage.app",
  messagingSenderId: "919354157334",
  appId: "1:919354157334:web:6c59886a3e23bd14da0837"
};

// ── Init ──────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const itemsCol = db.collection("items");
const notesCol = db.collection("notes");

// ── Tabs ──────────────────────────────────────
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(s => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ── Helpers ───────────────────────────────────
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

function fmtQty(qty, unit) {
  if (!qty && !unit) return "";
  if (qty && unit)  return `${qty} ${unit}`;
  if (qty)          return `${qty}`;
  return unit;
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
}

// ── Connection dot ─────────────────────────────
const dot = document.getElementById("status-dot");
db.enableNetwork().then(() => dot.className = "dot online").catch(() => {});

// ── ADD ITEM ──────────────────────────────────
document.getElementById("btn-add").addEventListener("click", async () => {
  const name = document.getElementById("item-name").value.trim();
  if (!name) { toast("⚠️ Enter an item name"); return; }
  const qty  = document.getElementById("item-qty").value.trim();
  const unit = document.getElementById("item-unit").value;
  try {
    await itemsCol.add({ name, qty, unit, bought: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    document.getElementById("item-name").value = "";
    document.getElementById("item-qty").value  = "";
    document.getElementById("item-unit").value = "";
    toast("✅ Item added!");
  } catch (e) { toast("❌ Error: " + e.message); }
});

// Enter key on item name
document.getElementById("item-name").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btn-add").click();
});

// ── REAL-TIME LISTENER ────────────────────────
itemsCol.orderBy("createdAt").onSnapshot(snap => {
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderPreview(items);
  renderShop(items);
  dot.className = "dot online";
}, () => { dot.className = "dot offline"; });

// ── RENDER: Add-tab preview ───────────────────
function renderPreview(items) {
  const ul  = document.getElementById("preview-list");
  const cnt = document.getElementById("item-count");
  cnt.textContent = items.length;
  ul.innerHTML = "";
  if (!items.length) { ul.innerHTML = '<li class="empty">No items yet 🛍️</li>'; return; }
  items.forEach(item => {
    const li  = document.createElement("li");
    const chk = document.createElement("span");
    chk.className = "item-check" + (item.bought ? " checked" : "");
    chk.textContent = item.bought ? "✓" : "";
    chk.addEventListener("click", () => itemsCol.doc(item.id).update({ bought: !item.bought }));

    const lbl = document.createElement("span");
    lbl.className = "item-label" + (item.bought ? " done" : "");
    lbl.textContent = item.name;

    const del = document.createElement("button");
    del.className = "btn-del";
    del.textContent = "🗑";
    del.title = "Delete";
    del.addEventListener("click", () => itemsCol.doc(item.id).delete());

    li.append(chk, lbl);
    const q = fmtQty(item.qty, item.unit);
    if (q) {
      const tag = document.createElement("span");
      tag.className = "item-qty-tag";
      tag.textContent = q;
      li.append(tag);
    }
    li.append(del);
    ul.append(li);
  });
}

// ── RENDER: Shop tab ──────────────────────────
function renderShop(items) {
  const ul = document.getElementById("shop-list");
  ul.innerHTML = "";
  if (!items.length) { ul.innerHTML = '<li class="empty">Nothing in the list yet 🛒</li>'; return; }
  const pending = items.filter(i => !i.bought);
  const done    = items.filter(i => i.bought);
  [...pending, ...done].forEach(item => {
    const li  = document.createElement("li");
    const chk = document.createElement("span");
    chk.className = "item-check" + (item.bought ? " checked" : "");
    chk.textContent = item.bought ? "✓" : "";
    chk.addEventListener("click", () => {
      itemsCol.doc(item.id).update({ bought: !item.bought });
      if (!item.bought) toast("🎉 Marked as bought!");
    });

    const lbl = document.createElement("span");
    lbl.className = "item-label" + (item.bought ? " done" : "");
    lbl.textContent = item.name;

    li.append(chk, lbl);
    const q = fmtQty(item.qty, item.unit);
    if (q) {
      const tag = document.createElement("span");
      tag.className = "item-qty-tag";
      tag.textContent = q;
      li.append(tag);
    }
    ul.append(li);
  });
}

// ── CLEAR BOUGHT ──────────────────────────────
document.getElementById("btn-clear-done").addEventListener("click", async () => {
  const snap = await itemsCol.where("bought", "==", true).get();
  if (snap.empty) { toast("No bought items to remove"); return; }
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  toast("🗑 Bought items removed");
});

// ── NOTES ─────────────────────────────────────
document.getElementById("btn-save-note").addEventListener("click", async () => {
  const text = document.getElementById("note-input").value.trim();
  if (!text) { toast("⚠️ Note is empty"); return; }
  try {
    await notesCol.add({ text, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    document.getElementById("note-input").value = "";
    toast("📝 Note saved!");
  } catch (e) { toast("❌ Error: " + e.message); }
});

notesCol.orderBy("createdAt", "desc").onSnapshot(snap => {
  const ul = document.getElementById("notes-list");
  ul.innerHTML = "";
  if (snap.empty) { ul.innerHTML = '<li class="empty">No notes yet 📭</li>'; return; }
  snap.docs.forEach(d => {
    const data = d.data();
    const li   = document.createElement("li");
    li.innerHTML = `
      <span class="note-time">${fmtTime(data.createdAt)}</span>
      <span class="note-text">${escHtml(data.text)}</span>
      <button class="btn-del-note" title="Delete note">✕</button>
    `;
    li.querySelector(".btn-del-note").addEventListener("click", () => notesCol.doc(d.id).delete());
    ul.append(li);
  });
});

function escHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
