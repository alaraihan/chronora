
const showToast = (msg, type = "success") => {
  Toastify({
    text: msg,
    duration: 3000,
    gravity: "bottom",
    position: "right",
    backgroundColor: type === "error" ? "#e74c3c" : "#27ae60",
  }).showToast();
};
const _recentToasts = new Set();
const showToastOnce = (msg, type = "success", ttl = 1500) => {
  const key = `${type}|${msg}`;
  if (_recentToasts.has(key)) return;
  _recentToasts.add(key);
  showToast(msg, type);
  setTimeout(() => _recentToasts.delete(key), ttl);
};

const toNumberFromText = (s) => {
  if (s === null || s === undefined) return 0;
  const cleaned = String(s).replace(/[^\d.-]/g, "");
  return Number(cleaned) || 0;
};

const inFlight = new Map();

document.addEventListener("DOMContentLoaded", () => {
  try {
    const minus = document.getElementById("qtyMinus");
    const plus  = document.getElementById("qtyPlus");
    const valueEl = document.getElementById("qtyValue");
    const wrapper = document.getElementById("quantityBox");
    if (!minus || !plus || !valueEl || !wrapper) {
      return;
    }

    let count = parseInt(wrapper.dataset.initial || "1", 10);
    const maxStock = parseInt(wrapper.dataset.maxStock || "1", 10) || Infinity;

    const updateUI = () => {
      valueEl.textContent = String(count);
      minus.disabled = count <= 1;
      plus.disabled = count >= maxStock;
    };

    minus.addEventListener("click", (e) => {
      e.preventDefault();
      if (count > 1) {
        count -= 1;
        updateUI();
      }
    });

    plus.addEventListener("click", (e) => {
      e.preventDefault();
      if (count < maxStock) {
        count += 1;
        updateUI();
      }
    });

    updateUI();
  } catch (err) {
    console.error("Quantity init error:", err);
  }
});

document.addEventListener("click", async (event) => {
  const btn = event.target.closest(".add-to-cart");
  if (!btn) return;

  event.preventDefault();
  event.stopPropagation();

  if (btn.disabled) return;

  const productId = btn.dataset.productId;
  const variantId = btn.dataset.variantId;
  const qtyEl = document.getElementById("qtyValue");
  const quantity = qtyEl ? Math.max(1, parseInt(qtyEl.textContent || "1", 10)) : 1;

  const key = `add-${productId}-${variantId}-${quantity}`;
  if (inFlight.get(key)) {
    console.log("Add already in flight for", key);
    return;
  }

  inFlight.set(key, true);
  btn.disabled = true;
  console.log("Add-to-cart request:", { productId, variantId, quantity, ts: Date.now() });

  try {
    const res = await axios.post("/cart/add", { productId, variantId, quantity });

    if (res.data && res.data.success) {
      showToastOnce("Added to cart!", "success");
      const cartCount = document.getElementById("cart-count");
      if (cartCount) {
        cartCount.textContent = (parseInt(cartCount.textContent || "0", 10) + 1).toString();
      }
    } else {
      const msg = res.data?.message || "Failed to add to cart";
      showToastOnce(msg, "error");
    }
  } catch (err) {
    const msg = err.response?.data?.message || "Something went wrong";
    showToastOnce(msg, "error");
    console.error("Add-to-cart error:", err);
  } finally {
    inFlight.delete(key);
    btn.disabled = false;
  }
});
