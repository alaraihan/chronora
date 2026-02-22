const toast = (msg, type = "success") => {
  Toastify({
    text: msg,
    duration: 4000,
    gravity: "bottom",
    position: "right",
    backgroundColor: type === "success" ? "#00c853" : "#f44336",
  }).showToast();
};

// ---------------------- ADDRESS MODAL ----------------------
document.getElementById('openAddressModal')?.addEventListener('click', () => {
  document.getElementById('addressModal').style.display = 'flex';
});

function closeModal() {
  const modal = document.getElementById('addressModal');
  const form = document.getElementById('addressForm');
  if (modal) modal.style.display = 'none';
  if (form) form.reset();
}

document.getElementById('closeModal')?.addEventListener('click', closeModal);
document.getElementById('cancelBtn')?.addEventListener('click', closeModal);
document.getElementById('addressModal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('addressModal')) closeModal();
});

document.getElementById('addressForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  try {
    const res = await axios.post('/address/add', Object.fromEntries(formData));

    if (res.data.success) {
      toast("Address added successfully!", "success");
      closeModal();

      const addressHtml = res.data.addresses.map((addr, i) => `
        <label class="address-option ${i === 0 ? 'selected' : ''}" data-id="${addr._id}">
          <input type="radio" name="selectedAddress" value="${addr._id}" ${i === 0 ? 'checked' : ''} />
          <div class="address-content">
            <div class="address-header">
              <strong>${addr.name || 'No Name'}</strong>
              ${addr.isDefaultShipping ? '<span class="default-badge">Default</span>' : ''}
            </div>
            <p>
              ${addr.street || ''}${addr.street ? ', ' : ''} 
              ${addr.city || ''}${addr.city ? ', ' : ''} 
              ${addr.state || ''} ${addr.zip || ''}
            </p>
            <p>Mobile: ${addr.phone || 'Not provided'}</p>
          </div>
        </label>
      `).join('');

      const addressList = document.getElementById('addressList');
      if (addressList) {
        addressList.innerHTML = addressHtml;
        attachAddressClickListeners();
      }
    }
  } catch (err) {
    toast(err.response?.data?.message || "Failed to add address", "error");
  }
});

function attachAddressClickListeners() {
  document.querySelectorAll('.address-option').forEach(label => {
    label.addEventListener('click', function (e) {
      if (e.target.tagName === 'INPUT') return;
      document.querySelectorAll('.address-option').forEach(l => l.classList.remove('selected'));
      this.classList.add('selected');
      const radio = this.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });
}

function attachPaymentClickListeners() {
  document.querySelectorAll('.payment-option').forEach(label => {
    label.addEventListener('click', function (e) {
      if (e.target.tagName === 'INPUT') return;
      document.querySelectorAll('.payment-option').forEach(l => l.classList.remove('selected'));
      this.classList.add('selected');
      const radio = this.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
}

attachAddressClickListeners();
attachPaymentClickListeners();

// ---------------------- COUPON LOGIC ----------------------
document.getElementById('applyCouponBtn')?.addEventListener('click', async () => {
  const codeInput = document.getElementById('couponCode');
  const code = codeInput?.value.trim().toUpperCase();
  const msgError = document.getElementById('couponMessage');
  const msgSuccess = document.getElementById('couponSuccess');
  const discountRow = document.getElementById('discountRow');
  const discountAmount = document.getElementById('discountAmount');
  const grandTotalDisplay = document.getElementById('grandTotalDisplay');

  if (msgError) msgError.style.display = 'none';
  if (msgSuccess) msgSuccess.style.display = 'none';

  if (!code) {
    if (msgError) {
      msgError.textContent = "Please enter a coupon code";
      msgError.style.display = 'block';
    }
    return;
  }

  try {
    const response = await axios.post('/checkout/apply-coupon', { couponCode: code });

    if (response.data.success) {
      if (msgSuccess) {
        msgSuccess.textContent = `Coupon "${code}" applied! ₹${response.data.discount} off`;
        msgSuccess.style.display = 'block';
      }
      if (discountAmount) discountAmount.textContent = response.data.discount.toLocaleString('en-IN');
      if (discountRow) discountRow.style.display = 'flex';

      const subtotalDisplay = document.getElementById('subtotalDisplay');
      if (subtotalDisplay && grandTotalDisplay) {
        const subtotal = parseFloat(subtotalDisplay.textContent.replace(/,/g, ''));
        const shipping = subtotal < 15000 ? 100 : 0;
        const newGrandTotal = subtotal + shipping - response.data.discount;
        grandTotalDisplay.textContent = newGrandTotal.toLocaleString('en-IN');
      }

      const placeOrderBtn = document.getElementById('placeOrderBtn');
      if (placeOrderBtn) {
        placeOrderBtn.dataset.discount = response.data.discount;
        placeOrderBtn.dataset.appliedCoupon = code;
      }

      if (codeInput) codeInput.disabled = true;
      const applyBtn = document.getElementById('applyCouponBtn');
      if (applyBtn) {
        applyBtn.textContent = "Applied ✓";
        applyBtn.disabled = true;
      }
      const removeBtn = document.getElementById('removeCouponBtn');
      if (removeBtn) removeBtn.style.display = 'block';
    } else {
      if (msgError) {
        msgError.textContent = response.data.message || "Invalid coupon";
        msgError.style.display = 'block';
      }
    }
  } catch (err) {
    if (msgError) {
      msgError.textContent = err.response?.data?.message || "Error applying coupon. Try again.";
      msgError.style.display = 'block';
    }
    console.error(err);
  }
});

document.getElementById('removeCouponBtn')?.addEventListener('click', function () {
  const codeInput = document.getElementById('couponCode');
  const msgSuccess = document.getElementById('couponSuccess');
  const msgError = document.getElementById('couponMessage');
  const discountRow = document.getElementById('discountRow');
  const discountAmount = document.getElementById('discountAmount');
  const grandTotalDisplay = document.getElementById('grandTotalDisplay');
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  const applyBtn = document.getElementById('applyCouponBtn');

  if (codeInput) {
    codeInput.value = '';
    codeInput.disabled = false;
  }
  if (msgSuccess) msgSuccess.style.display = 'none';
  if (msgError) msgError.style.display = 'none';
  if (discountRow) discountRow.style.display = 'none';
  if (discountAmount) discountAmount.textContent = '0';

  const subtotalDisplay = document.getElementById('subtotalDisplay');
  if (subtotalDisplay && grandTotalDisplay) {
    const subtotal = parseFloat(subtotalDisplay.textContent.replace(/,/g, ''));
    const shipping = subtotal < 15000 ? 100 : 0;
    const newGrandTotal = subtotal + shipping;
    grandTotalDisplay.textContent = newGrandTotal.toLocaleString('en-IN');
  }

  if (placeOrderBtn) {
    delete placeOrderBtn.dataset.discount;
    delete placeOrderBtn.dataset.appliedCoupon;
  }

  if (applyBtn) {
    applyBtn.textContent = "Apply";
    applyBtn.disabled = false;
  }
  this.style.display = 'none';

  toast("Coupon removed successfully", "success");
});

// ---------------------- WALLET LOGIC ----------------------
document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
  radio.addEventListener('change', function () {
    const walletRow = document.getElementById('walletPayable');
    const amountEl = document.getElementById('walletPayableAmount');
    const walletBalanceDisplay = document.getElementById('walletBalanceDisplay');
    const grandTotalDisplay = document.getElementById('grandTotalDisplay');

    if (this.value === 'wallet') {
      if (grandTotalDisplay) {
        const total = parseFloat(grandTotalDisplay.textContent.replace(/,/g, ''));
        const walletBalance = parseFloat(walletBalanceDisplay?.textContent.replace(/[^0-9.]/g, '') || '0');

        if (amountEl) amountEl.textContent = total.toLocaleString('en-IN');
        if (walletRow) walletRow.style.display = 'flex';

        if (walletBalance < total) {
          toast(`Insufficient wallet balance. Available: ₹${walletBalance.toLocaleString('en-IN')}, Required: ₹${total.toLocaleString('en-IN')}`, "error");
        }
      }
    } else {
      if (walletRow) walletRow.style.display = 'none';
    }
  });
});

// ---------------------- COUPONS MODAL ----------------------
document.getElementById('viewCouponsBtn')?.addEventListener('click', async function () {
  const modal = document.getElementById('couponsModal');
  const container = document.getElementById('couponsContainer');

  if (!modal || !container) return;

  modal.style.display = 'flex';
  container.innerHTML = '<div class="text-center" style="padding: 40px;"><p>Loading coupons...</p></div>';

  try {
    const response = await fetch('/coupons/available');
    const data = await response.json();

    if (data.success && data.coupons && data.coupons.length > 0) {
      container.innerHTML = data.coupons.map(coupon => `
        <div class="coupon-card" style="border: 2px dashed #667eea; border-radius: 12px; padding: 16px; margin-bottom: 16px; background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
            <div>
              <h4 style="margin: 0; color: #667eea; font-size: 18px; font-weight: 700;">${coupon.code}</h4>
              <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">${coupon.name}</p>
            </div>
            <button class="apply-coupon-btn" data-code="${coupon.code}" style="background: #667eea; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">
              APPLY
            </button>
          </div>
          ${coupon.description ? `<p style="margin: 8px 0; color: #555; font-size: 13px;">${coupon.description}</p>` : ''}
          <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px;">
            <div style="font-size: 13px;">
              <strong style="color: #2ecc71;">
                ${coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF${coupon.maxDiscountLimit ? ` (Max ₹${coupon.maxDiscountLimit})` : ''}` : `₹${coupon.discountValue} OFF`}
              </strong>
            </div>
            ${coupon.minPurchase > 0 ? `<div style="font-size: 13px; color: #666;">Min: ₹${coupon.minPurchase.toLocaleString('en-IN')}</div>` : ''}
            <div style="font-size: 13px; color: #666;">Valid till: ${new Date(coupon.expiryDate).toLocaleDateString('en-IN')}</div>
          </div>
          ${coupon.totalUsageLimit ? `<div style="margin-top: 8px; font-size: 12px; color: #999;">${coupon.totalUsageLimit - coupon.usedCount} uses remaining</div>` : ''}
        </div>
      `).join('');

      document.querySelectorAll('.apply-coupon-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          const code = this.dataset.code;
          const couponInput = document.getElementById('couponCode');
          const applyBtn = document.getElementById('applyCouponBtn');

          if (couponInput) couponInput.value = code;
          if (applyBtn) applyBtn.click();
          modal.style.display = 'none';
        });
      });

    } else {
      container.innerHTML = `<div class="text-center" style="padding: 40px;"><p style="color: #999; font-size: 16px;">No coupons available at the moment</p></div>`;
    }
  } catch (error) {
    console.error('Error fetching coupons:', error);
    container.innerHTML = `<div class="text-center" style="padding: 40px;"><p style="color: #ef4444;">Failed to load coupons. Please try again.</p></div>`;
  }
});

document.getElementById('closeCouponsModal')?.addEventListener('click', function () {
  const modal = document.getElementById('couponsModal');
  if (modal) modal.style.display = 'none';
});

// ---------------------- STOCK CHECK ----------------------
let stockCheckInterval = null;

async function checkStockAndTogglePayment(showErrorToast = false) {
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  const soldOutMsg = document.getElementById('soldOutMessage');

  // If elements don't exist, silently return
  if (!placeOrderBtn) return;

  try {
    const res = await axios.get('/checkout/check-stock');

    if (res.data && res.data.stockAvailable !== undefined) {
      if (res.data.stockAvailable) {
        placeOrderBtn.style.display = 'block';
        if (soldOutMsg) soldOutMsg.style.display = 'none';
      } else {
        placeOrderBtn.style.display = 'none';
        if (soldOutMsg) soldOutMsg.style.display = 'block';
        if (showErrorToast) {
          toast("Some items are out of stock", "error");
        }
      }
    }
  } catch (err) {
    // Only log to console, don't show error toast on initial load
    console.warn("Stock check unavailable:", err.message);
    // Keep the button visible if stock check fails
    if (placeOrderBtn) placeOrderBtn.style.display = 'block';
  }
}

// Initial check without error toast
checkStockAndTogglePayment(false);

// Auto-refresh stock every 30 seconds (reduced from 5 seconds)
stockCheckInterval = setInterval(() => {
  checkStockAndTogglePayment(true); // Show toast on subsequent checks if out of stock
}, 30000);

// Clean up interval when page unloads
window.addEventListener('beforeunload', () => {
  if (stockCheckInterval) {
    clearInterval(stockCheckInterval);
  }
});

// ---------------------- PLACE ORDER ----------------------
document.getElementById('placeOrderBtn')?.addEventListener('click', async function () {
  const selectedAddress = document.querySelector('input[name="selectedAddress"]:checked')?.value;
  const paymentMethodInput = document.querySelector('input[name="paymentMethod"]:checked');
  const paymentMethod = paymentMethodInput?.value;
  const appliedDiscount = parseFloat(this.dataset.discount) || 0;
  const appliedCoupon = this.dataset.appliedCoupon || null;

  if (!selectedAddress) {
    toast("Please select a delivery address", "error");
    return;
  }
  if (!paymentMethod) {
    toast("Please select a payment method", "error");
    return;
  }

  const subtotalDisplay = document.getElementById('subtotalDisplay');
  const grandTotalDisplay = document.getElementById('grandTotalDisplay');

  if (!subtotalDisplay || !grandTotalDisplay) {
    toast("Error loading order details. Please refresh the page.", "error");
    return;
  }

  const subtotal = parseFloat(subtotalDisplay.textContent.replace(/,/g, ''));
  const shipping = subtotal < 15000 ? 100 : 0;
  const finalAmount = subtotal + shipping - appliedDiscount;

  // Wallet balance check
  if (paymentMethod === 'wallet') {
    const walletBalanceDisplay = document.getElementById('walletBalanceDisplay');
    const walletBalance = parseFloat(walletBalanceDisplay?.textContent.replace(/[^0-9.]/g, '') || '0');

    if (walletBalance < finalAmount) {
      toast(`Insufficient wallet balance. Available: ₹${walletBalance.toLocaleString('en-IN')}, Required: ₹${finalAmount.toLocaleString('en-IN')}`, "error");
      return;
    }
  }

  // Save checkout summary
  sessionStorage.setItem('checkoutSummary', JSON.stringify({
    subtotal,
    shipping,
    discount: appliedDiscount,
    totalAmount: finalAmount
  }));

  this.disabled = true;
  const originalText = this.textContent;
  this.textContent = 'Processing...';

  try {
    if (paymentMethod === "razorpay") {
      if (typeof Razorpay === 'undefined') {
        throw new Error("Payment gateway not loaded. Please refresh the page.");
      }

      const orderResponse = await axios.post('/create-order', { amount: finalAmount });

      if (!orderResponse.data.success) {
        throw new Error(orderResponse.data.message || "Failed to create payment order");
      }

      const { order_id, amount, key_id } = orderResponse.data;

      const options = {
        key: key_id,
        amount,
        currency: "INR",
        name: "Chronora",
        description: "Luxury Watch Purchase",
        image: "/images/logo.png",
        order_id,
        handler: async function (response) {
          try {
            const placeOrderRes = await axios.post('/checkout/place-order', {
              selectedAddress,
              paymentMethod: 'razorpay',
              discount: appliedDiscount,
              appliedCoupon,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });

            if (placeOrderRes.data.success) {
              toast("Payment successful! Order placed 🎉", "success");
              sessionStorage.removeItem('checkoutSummary');
              setTimeout(() => {
                window.location.href = placeOrderRes.data.redirect;
              }, 1000);
            } else {
              toast(placeOrderRes.data.message || "Order failed after payment", "error");
              window.location.href = `/checkout/failure?error=${encodeURIComponent(placeOrderRes.data.message || "Order processing failed")}`;
            }
          } catch (err) {
            console.error("Order confirmation error:", err);
            window.location.href = `/checkout/failure?error=${encodeURIComponent("Failed to confirm order with server")}`;
          }
        },
        prefill: {
          name: "<%= user.name %>",
          email: "<%= user.email %>",
          contact: "<%= user.phone || '' %>"
        },
        theme: { color: "#3399cc" },
        modal: {
          ondismiss: async () => {
            toast("Payment cancelled", "error");

            // Record failed order in DB
            try {
              await axios.post('/checkout/place-order', {
                selectedAddress,
                paymentMethod: 'razorpay',
                discount: appliedDiscount,
                appliedCoupon,
                paymentStatus: 'Failed'
              });
            } catch (recordErr) {
              console.error("Failed to record unsuccessful order:", recordErr);
            }

            this.disabled = false;
            this.textContent = originalText;
          }
        }
      };

      const rzp = new Razorpay(options);

      rzp.on('payment.failed', async (resp) => {
        const errorMsg = resp.error?.description || 'Payment declined';
        toast(`Payment failed: ${errorMsg}`, 'error');

        // Record failed order in DB
        try {
          await axios.post('/checkout/place-order', {
            selectedAddress,
            paymentMethod: 'razorpay',
            discount: appliedDiscount,
            appliedCoupon,
            paymentStatus: 'Failed'
          });
        } catch (recordErr) {
          console.error("Failed to record unsuccessful order:", recordErr);
        }

        this.disabled = false;
        this.textContent = originalText;
        window.location.href = `/checkout/failure?error=${encodeURIComponent(errorMsg)}`;
      });

      rzp.open();

    } else {
      // COD or Wallet payment
      const res = await axios.post('/checkout/place-order', {
        selectedAddress,
        paymentMethod,
        discount: appliedDiscount,
        appliedCoupon
      });

      if (res.data.success) {
        toast("Order placed successfully!", "success");
        sessionStorage.removeItem('checkoutSummary');
        setTimeout(() => {
          window.location.href = res.data.redirect;
        }, 800);
      } else {
        toast(res.data.message || "Order failed", "error");
        window.location.href = `/checkout/failure?error=${encodeURIComponent(res.data.message || 'Order could not be placed')}`;
      }
    }
  } catch (err) {
    const errorMessage = err.response?.data?.message || err.message || "Something went wrong.";

    if (err.response?.status === 409) {
      toast("Some items went out of stock", "error");
      window.location.href = `/checkout/failure?error=${encodeURIComponent(errorMessage || 'Stock unavailable')}`;
    } else {
      toast(errorMessage, "error");
    }

    console.error('Place order error:', err);
    this.disabled = false;
    this.textContent = originalText;
  }
});