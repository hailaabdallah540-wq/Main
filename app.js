(function () {
  const $ = (id) => document.getElementById(id);
  const CART_KEY = "store-cart";
  const ALL = "الكل";

  let activeCategory = ALL;
  let cart = loadCart();

  // ---------- أدوات ----------
  function money(n) {
    return n.toLocaleString("en-US") + " " + STORE.currency;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function visual(p) {
    return p.image
      ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">`
      : escapeHtml(p.icon || "📦");
  }
  function findProduct(id) {
    return PRODUCTS.find((p) => p.id === id);
  }
  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch { return {}; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 1600);
  }

  // ---------- المتجر ----------
  function renderHeader() {
    document.title = STORE.name;
    $("storeName").innerHTML = `<span class="logo" aria-label="${escapeHtml(STORE.name)}"><span class="o">o</span><span class="p">p</span></span>`;
    $("storeTagline").textContent = STORE.tagline;
    $("footerName").textContent = STORE.name;
    $("year").textContent = new Date().getFullYear();
  }

  function renderCategories() {
    const cats = [ALL, ...new Set(PRODUCTS.map((p) => p.category))];
    $("categories").innerHTML = cats
      .map((c) => `<button class="chip${c === activeCategory ? " active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
      .join("");
  }

  function renderProducts() {
    const q = $("search").value.trim().toLowerCase();
    const list = PRODUCTS.filter((p) =>
      (activeCategory === ALL || p.category === activeCategory) &&
      (!q || (p.name + " " + (p.description || "")).toLowerCase().includes(q))
    );
    $("noResults").hidden = list.length > 0;
    $("products").innerHTML = list.map((p) => {
      const sale = p.oldPrice && p.oldPrice > p.price;
      return `
        <article class="card">
          <div class="thumb">${visual(p)}${sale ? `<span class="tag-sale">خصم ${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>` : ""}</div>
          <div class="card-body">
            <h3>${escapeHtml(p.name)}</h3>
            <p>${escapeHtml(p.description || "")}</p>
            <div class="price-row">
              <span class="price">${money(p.price)}${sale ? `<span class="old">${money(p.oldPrice)}</span>` : ""}</span>
              <button class="add" data-add="${p.id}">أضف للسلة</button>
            </div>
          </div>
        </article>`;
    }).join("");
  }

  // ---------- السلة ----------
  function cartItems() {
    return Object.entries(cart)
      .map(([id, qty]) => ({ product: findProduct(Number(id)), qty }))
      .filter((i) => i.product && i.qty > 0);
  }

  function totals() {
    const subtotal = cartItems().reduce((s, i) => s + i.product.price * i.qty, 0);
    const free = STORE.freeDeliveryOver > 0 && subtotal >= STORE.freeDeliveryOver;
    const delivery = subtotal === 0 || free ? 0 : STORE.deliveryFee;
    return { subtotal, delivery, total: subtotal + delivery };
  }

  function renderCart() {
    const items = cartItems();
    const count = items.reduce((s, i) => s + i.qty, 0);
    $("cartCount").textContent = count;
    $("cartEmpty").hidden = items.length > 0;
    $("checkout").hidden = items.length === 0;

    $("cartList").innerHTML = items.map(({ product: p, qty }) => `
      <li class="cart-item">
        <div class="mini">${visual(p)}</div>
        <div>
          <h4>${escapeHtml(p.name)}</h4>
          <small>${money(p.price)} × ${qty} = ${money(p.price * qty)}</small>
        </div>
        <div class="qty">
          <button data-inc="${p.id}" aria-label="زيادة">+</button>
          <span>${qty}</span>
          <button data-dec="${p.id}" aria-label="إنقاص">−</button>
        </div>
      </li>`).join("");

    const t = totals();
    $("subtotal").textContent = money(t.subtotal);
    $("delivery").textContent = t.delivery === 0 ? "مجاني" : money(t.delivery);
    $("total").textContent = money(t.total);
    const remaining = STORE.freeDeliveryOver - t.subtotal;
    $("freeHint").textContent =
      STORE.freeDeliveryOver > 0 && STORE.deliveryFee > 0 && remaining > 0
        ? `باقي لك ${money(remaining)} وتحصل على توصيل مجاني 🚚`
        : "";
  }

  function changeQty(id, delta) {
    cart[id] = (cart[id] || 0) + delta;
    if (cart[id] <= 0) delete cart[id];
    saveCart();
    renderCart();
  }

  function openCart(open) {
    $("drawer").classList.toggle("open", open);
    $("drawer").setAttribute("aria-hidden", String(!open));
    $("overlay").hidden = !open;
  }

  // ---------- الطلب عبر الواتساب ----------
  function sendOrder(form) {
    const data = Object.fromEntries(new FormData(form));
    const t = totals();
    const lines = [
      `طلب جديد من ${STORE.name} 🛍️`,
      "",
      ...cartItems().map((i) => `• ${i.product.name} × ${i.qty} = ${money(i.product.price * i.qty)}`),
      "",
      `المجموع: ${money(t.subtotal)}`,
      `التوصيل: ${t.delivery === 0 ? "مجاني" : money(t.delivery)}`,
      `الإجمالي: ${money(t.total)}`,
      "",
      `الاسم: ${data.name}`,
      `الجوال: ${data.phone}`,
      `العنوان: ${data.address}`,
    ];
    if (data.notes) lines.push(`ملاحظات: ${data.notes}`);

    const url = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");

    cart = {};
    saveCart();
    renderCart();
    form.reset();
    openCart(false);
    toast("تم تجهيز طلبك في الواتساب ✅");
  }

  // ---------- الأحداث ----------
  $("categories").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    renderCategories();
    renderProducts();
  });
  $("search").addEventListener("input", renderProducts);
  $("products").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add]");
    if (!btn) return;
    changeQty(Number(btn.dataset.add), 1);
    toast("تمت الإضافة للسلة");
  });
  $("cartList").addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    if (inc) changeQty(Number(inc.dataset.inc), 1);
    if (dec) changeQty(Number(dec.dataset.dec), -1);
  });
  $("openCart").addEventListener("click", () => openCart(true));
  $("closeCart").addEventListener("click", () => openCart(false));
  $("overlay").addEventListener("click", () => openCart(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") openCart(false); });
  $("orderForm").addEventListener("submit", (e) => {
    e.preventDefault();
    sendOrder(e.target);
  });

  renderHeader();
  renderCategories();
  renderProducts();
  renderCart();
})();
