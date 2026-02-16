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

async function getCurrentCartQuantity(productId, variantId) {
  try {
    const res = await axios.get(`/cart/quantity?productId=${productId}&variantId=${variantId}`);
    return res.data.quantity || 0;
  } catch (err) {
    console.error("Error fetching cart quantity:", err);
    return 0;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    const minus = document.getElementById("qtyMinus");
    const plus  = document.getElementById("qtyPlus");
    const valueEl = document.getElementById("qtyValue");
    const wrapper = document.getElementById("quantityBox");
    const addToCartBtn = document.querySelector(".add-to-cart");
    
    if (!minus || !plus || !valueEl || !wrapper) {
      return;
    }

    let count = parseInt(wrapper.dataset.initial || "1", 10);
    const maxStock = parseInt(wrapper.dataset.maxStock || "1", 10);
    
    const isOutOfStock = maxStock <= 0 || (addToCartBtn && addToCartBtn.disabled);

    const updateUI = () => {
      valueEl.textContent = String(count);
      
      minus.disabled = count <= 1 || isOutOfStock;
      
      plus.disabled = count >= maxStock || isOutOfStock;
      
      if (addToCartBtn && isOutOfStock) {
        addToCartBtn.disabled = true;
        addToCartBtn.textContent = "Out of Stock";
      }
    };

    minus.addEventListener("click", (e) => {
      e.preventDefault();
      if (isOutOfStock) {
        showToastOnce("This item is out of stock", "error");
        return;
      }
      if (count > 1) {
        count -= 1;
        updateUI();
      }
    });

    plus.addEventListener("click", (e) => {
      e.preventDefault();
      
      if (isOutOfStock) {
        showToastOnce("This item is out of stock", "error");
        return;
      }
      
      if (count >= maxStock) {
        showToastOnce(`Only ${maxStock} item${maxStock > 1 ? 's' : ''} available in stock`, "error");
        return;
      }
      
      if (count < maxStock) {
        count += 1;
        updateUI();
      }
    });

    updateUI();
    
    if (isOutOfStock) {
      const stockStatusEl = document.querySelector('.status');
      if (stockStatusEl) {
        stockStatusEl.innerHTML = '<span style="color:#dc3545; font-weight:bold;">Out of Stock</span>';
      }
    }
    
  } catch (err) {
    console.error("Quantity init error:", err);
  }
});

document.addEventListener("click", async (event) => {
  const btn = event.target.closest(".add-to-cart");
  if (!btn) return;

  event.preventDefault();
  event.stopPropagation();

  if (btn.disabled) {
    showToastOnce("This item is out of stock and cannot be added to cart", "error");
    return;
  }

  const productId = btn.dataset.productId;
  const variantId = btn.dataset.variantId;
  
  if (!productId || !variantId) {
    showToastOnce("Invalid product or variant", "error");
    return;
  }

  const qtyEl = document.getElementById("qtyValue");
  const requestedQuantity = qtyEl ? Math.max(1, parseInt(qtyEl.textContent || "1", 10)) : 1;
  
  const wrapper = document.getElementById("quantityBox");
  const maxStock = wrapper ? parseInt(wrapper.dataset.maxStock || "0", 10) : 0;
  
  if (maxStock <= 0) {
    showToastOnce("This item is out of stock", "error");
    btn.disabled = true;
    btn.textContent = "Out of Stock";
    return;
  }

  const key = `add-${productId}-${variantId}-${requestedQuantity}`;
  if (inFlight.get(key)) {
    console.log("Add already in flight for", key);
    return;
  }

  inFlight.set(key, true);
  btn.disabled = true;
  
  const originalText = btn.textContent;
  btn.textContent = "Checking...";

  try {
    const cartCheck = await axios.get(`/cart/check-item?productId=${productId}&variantId=${variantId}`);
    const currentCartQuantity = cartCheck.data.quantity || 0;
    
    const totalQuantity = currentCartQuantity + requestedQuantity;
    
    if (totalQuantity > maxStock) {
      const availableToAdd = Math.max(0, maxStock - currentCartQuantity);
      
      if (availableToAdd <= 0) {
        showToastOnce(`You already have all ${maxStock} item${maxStock > 1 ? 's' : ''} in your cart`, "error");
      } else {
        showToastOnce(`Only ${availableToAdd} more item${availableToAdd > 1 ? 's' : ''} available (you have ${currentCartQuantity} in cart)`, "error");
      }
      
      if (qtyEl && availableToAdd > 0) {
        qtyEl.textContent = Math.min(requestedQuantity, availableToAdd).toString();
      }
      
      return;
    }

    btn.textContent = "Adding...";
    console.log("Add-to-cart request:", { productId, variantId, quantity: requestedQuantity, ts: Date.now() });

    const res = await axios.post("/cart/add", { 
      productId, 
      variantId, 
      quantity: requestedQuantity 
    });

    if (res.data && res.data.success) {
      showToastOnce("Added to cart!", "success");
      
      const cartCount = document.getElementById("cart-count");
      if (cartCount) {
        const currentCount = parseInt(cartCount.textContent || "0", 10);
        cartCount.textContent = (currentCount + requestedQuantity).toString();
      }
      
      const remainingStock = maxStock - (currentCartQuantity + requestedQuantity);
      if (remainingStock > 0) {
        showToastOnce(`${remainingStock} item${remainingStock > 1 ? 's' : ''} left in stock`, "info", 2000);
      } else if (remainingStock === 0) {
        showToastOnce("This item is now out of stock", "warning", 2000);
        
        btn.disabled = true;
        btn.textContent = "Out of Stock";
        
        const minus = document.getElementById("qtyMinus");
        const plus = document.getElementById("qtyPlus");
        if (minus) minus.disabled = true;
        if (plus) plus.disabled = true;
      }
    } else {
      const msg = res.data?.message || "Failed to add to cart";
      showToastOnce(msg, "error");
    }
  } catch (err) {
    const msg = err.response?.data?.message || "Something went wrong";
    showToastOnce(msg, "error");
    console.error("Add-to-cart error:", err);
    
    if (err.response?.status === 401) {
      setTimeout(() => {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      }, 1500);
    }
  } finally {
    inFlight.delete(key);
    
    if (!btn.disabled && btn.textContent !== "Out of Stock") {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
});



window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

document.addEventListener("click", (event) => {
  const variantBtn = event.target.closest(".variant-btn");
  if (variantBtn && !variantBtn.classList.contains('active')) {
    const currentQty = document.getElementById("qtyValue")?.textContent || "1";
    if (currentQty !== "1") {
      showToastOnce("Quantity will reset when changing variant", "info", 2000);
    }
  }
});