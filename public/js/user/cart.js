const showToast = (msg, type = "success") => {
  Toastify({
    text: msg,
    duration: 3000,
    gravity: "bottom",
    position: "right",
    backgroundColor: type === "error" ? "#e74c3c" : "#27ae60",
  }).showToast();
};

const toNumberFromText = (s) => {
  if (s === null || s === undefined) return 0;
  const cleaned = String(s).replace(/[^\d.-]/g, "");
  return Number(cleaned) || 0;
};

function updateOrderSummary() {
  let subtotal = 0;

  document.querySelectorAll(".line-total").forEach((el) => {
    const value = (el.textContent || el.innerText || "").trim();
    subtotal += toNumberFromText(value);
  });

  const shipping = subtotal < 15000 && subtotal > 0 ? 100 : 0;
  const total = subtotal + shipping;

  const subtotalEl = document.getElementById("cartSubtotal");
  const shippingEl = document.getElementById("shippingAmount");
  const totalEl = document.getElementById("totalAmount");
  const freeShipNote = document.querySelector(".free-shipping-note");

  if (subtotalEl) {
    subtotalEl.textContent = "₹" + subtotal.toLocaleString("en-IN");
  }

  if (shippingEl) {
    shippingEl.innerHTML =
      shipping === 0
        ? '<span style="color:#4ade80; font-weight:600;">FREE</span>'
        : "₹" + shipping.toLocaleString("en-IN");
  }

  if (totalEl) {
    totalEl.textContent = "₹" + total.toLocaleString("en-IN");
  }

  if (freeShipNote) {
    if (subtotal < 15000 && shipping > 0) {
      freeShipNote.innerHTML = `Shop ₹${(15000 - subtotal).toLocaleString("en-IN")} more for <strong>FREE</strong> shipping!`;
      freeShipNote.style.display = "block";
    } else {
      freeShipNote.style.display = "none";
    }
  }
}

function setCheckoutState(canCheckout) {
  const checkoutBtn = document.getElementById("checkoutBtn");
  if (!checkoutBtn) return;
  if (canCheckout) {
    checkoutBtn.classList.add("active");
    checkoutBtn.removeAttribute("disabled");
    if (checkoutBtn.tagName.toLowerCase() === "a") checkoutBtn.href = "/checkout";
  } else {
    checkoutBtn.classList.remove("active");
    checkoutBtn.setAttribute("disabled", "disabled");
    if (checkoutBtn.tagName.toLowerCase() === "a") checkoutBtn.removeAttribute("href");
  }
}

const cartContainer = document.getElementById("cartItemsContainer") || document.body;
const inFlightRequests = new Map();

cartContainer.addEventListener("click", async (e) => {
  const btn = e.target.closest(".increment, .decrement, .remove-item, .add-to-cart");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  if (btn.classList.contains("increment") || btn.classList.contains("decrement")) {
    const id = btn.dataset.id || btn.closest("[data-item-id]")?.dataset.itemId;
    if (!id) return;

    const action = btn.classList.contains("increment") ? "increment" : "decrement";
    const key = `qty-${id}`;
    if (inFlightRequests.get(key)) return;
    inFlightRequests.set(key, true);
    btn.disabled = true;

    try {
      const res = await axios.post(`/cart/update/${id}`, { action });

      if (!res.data.success) {
        showToast(res.data.message || "Stock finished", "warning");

        const row = document.querySelector(`[data-item-id="${id}"]`);
        if (row) {
          const incBtn = row.querySelector(".increment");
          if (incBtn) incBtn.disabled = true;
        }

        return;
      }


      const row = document.querySelector(`[data-item-id="${id}"]`);
      if (!row) return;

      const qtyEl = row.querySelector(".qty-display");
      if (qtyEl && typeof res.data.quantity !== "undefined") {
        qtyEl.textContent = res.data.quantity;
      }

      const lineTotalEl = row.querySelector(".line-total");
      if (lineTotalEl && typeof res.data.lineTotal !== "undefined") {
        lineTotalEl.textContent = Number(res.data.lineTotal).toLocaleString("en-IN");
      }

      const stock = Number(res.data.stock ?? row.dataset.stock ?? 0);
      const decBtn = row.querySelector(".decrement");
      const incBtn = row.querySelector(".increment");
      if (decBtn) decBtn.disabled = res.data.quantity <= 1;
      if (incBtn) incBtn.disabled = res.data.quantity >= stock;

      if (res.data.removed) {
        row.remove();
        showToast("Item removed from cart");
      } else {
        showToast("Cart updated");
      }

      if (typeof res.data.canCheckout !== "undefined") {
        setCheckoutState(res.data.canCheckout);
      }

      updateOrderSummary();

      if (document.querySelectorAll(".cart-item").length === 0) {
        location.reload();
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Error updating cart", "error");
    } finally {
      inFlightRequests.delete(key);
      btn.disabled = false;
    }

    return;
  }

  if (btn.classList.contains("remove-item")) {
    const itemId = btn.dataset.id || btn.closest("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;

    const modal = document.getElementById("confirmModal");
    if (!modal) return;
    modal.dataset.removeItemId = itemId;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    return;
  }

  if (btn.classList.contains("add-to-cart")) {
    const productId = btn.dataset.productId;
    const variantId = btn.dataset.variantId;
    const key = `add-${productId}-${variantId || ""}`;
    if (inFlightRequests.get(key)) return;
    inFlightRequests.set(key, true);
    btn.disabled = true;

    try {
      const payload = { productId };
      if (variantId) payload.variantId = variantId;

      const res = await axios.post("/cart/add", payload);

      if (!res.data.success) {
        showToast(res.data.message || "Failed to add to cart", "error");
        return;
      }

      showToast("Added to cart");
      updateOrderSummary();
      setCheckoutState(res.data.canCheckout ?? true);
    } catch (err) {
      showToast(err.response?.data?.message || "Error adding to cart", "error");
    } finally {
      inFlightRequests.delete(key);
      btn.disabled = false;
    }
  }
});

const confirmModal = document.getElementById("confirmModal");
const confirmRemoveBtn = document.getElementById("confirmRemove");
const cancelRemoveBtn = document.getElementById("cancelRemove");

if (confirmRemoveBtn) {
  confirmRemoveBtn.addEventListener("click", async () => {
    const itemToRemove = confirmModal.dataset.removeItemId;
    if (!itemToRemove) return;

    try {
      const res = await axios.post(`/cart/remove/${itemToRemove}`);
      if (res.data.success) {
        document.querySelector(`[data-item-id="${itemToRemove}"]`)?.remove();
        showToast("Removed from cart");
        if (res.data.canCheckout !== undefined) setCheckoutState(res.data.canCheckout);
        updateOrderSummary();

        if (document.querySelectorAll(".cart-item").length === 0) {
          location.reload();
        }
      }
    } catch (err) {
      showToast("Failed to remove item", "error");
    } finally {
      confirmModal.classList.remove("active");
      document.body.style.overflow = "";
      delete confirmModal.dataset.removeItemId;
    }
  });
}

/* ── Close triggers ── */
document.querySelectorAll('.close-modal, .btn-cancel-modal, [data-close]').forEach(el => {
  el.addEventListener('click', () => {
    const id = el.dataset.close;
    if (id === 'confirmModal' || el.closest('#confirmModal')) {
      confirmModal.classList.remove('active');
      document.body.style.overflow = '';
      delete confirmModal.dataset.removeItemId;
    }
  });
});

/* Esc key */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && confirmModal.classList.contains('active')) {
    confirmModal.classList.remove('active');
    document.body.style.overflow = '';
    delete confirmModal.dataset.removeItemId;
  }
});

/* Backdrop click */
confirmModal?.addEventListener('click', (e) => {
  if (e.target === confirmModal) {
    confirmModal.classList.remove('active');
    document.body.style.overflow = '';
    delete confirmModal.dataset.removeItemId;
  }
});

updateOrderSummary();