const toast = (msg, type = "success") => {
  Toastify({
    text: msg,
    duration: 4000,
    gravity: "bottom",
    position: "right",
    backgroundColor: type === "success" ? "#00c853" : "#f44336",
  }).showToast();
};

document.getElementById('openAddressModal')?.addEventListener('click', () => {
  document.getElementById('addressModal').style.display = 'flex';
});

function closeModal() {
  document.getElementById('addressModal').style.display = 'none';
  document.getElementById('addressForm').reset();
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

      document.getElementById('addressList').innerHTML = addressHtml;
      attachAddressClickListeners();
    }
  } catch (err) {
    toast(err.response?.data?.message || "Failed to add address", "error");
  }
});

function attachAddressClickListeners() {
  document.querySelectorAll('.address-option').forEach(label => {
    label.addEventListener('click', function(e) {
      if (e.target.tagName === 'INPUT') return;
      document.querySelectorAll('.address-option').forEach(l => l.classList.remove('selected'));
      this.classList.add('selected');
      this.querySelector('input[type="radio"]').checked = true;
    });
  });
}

function attachPaymentClickListeners() {
  document.querySelectorAll('.payment-option').forEach(label => {
    label.addEventListener('click', function(e) {
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

document.getElementById('applyCouponBtn')?.addEventListener('click', async () => {
  const codeInput = document.getElementById('couponCode');
  const code = codeInput.value.trim().toUpperCase();

  const msgError = document.getElementById('couponMessage');
  const msgSuccess = document.getElementById('couponSuccess');
  const discountRow = document.getElementById('discountRow');
  const discountAmount = document.getElementById('discountAmount');
  const grandTotalDisplay = document.getElementById('grandTotalDisplay');

  msgError.style.display = 'none';
  msgSuccess.style.display = 'none';

  if (!code) {
    msgError.textContent = "Please enter a coupon code";
    msgError.style.display = 'block';
    return;
  }

  try {
    const response = await axios.post('/checkout/apply-coupon', { couponCode: code });

    if (response.data.success) {
      msgSuccess.textContent = `Coupon "${code}" applied! ₹${response.data.discount} off`;
      msgSuccess.style.display = 'block';

      discountAmount.textContent = response.data.discount.toLocaleString('en-IN');
      discountRow.style.display = 'flex';

      const subtotal = parseFloat(document.getElementById('subtotalDisplay').textContent.replace(/,/g, ''));
      const shipping = subtotal < 15000 ? 100 : 0;
      const newGrandTotal = subtotal + shipping - response.data.discount;
      grandTotalDisplay.textContent = newGrandTotal.toLocaleString('en-IN');

      document.getElementById('placeOrderBtn').dataset.discount = response.data.discount;
      document.getElementById('placeOrderBtn').dataset.appliedCoupon = code;

      codeInput.disabled = true;
      document.getElementById('applyCouponBtn').textContent = "Applied ✓";
    } else {
      msgError.textContent = response.data.message || "Invalid coupon";
      msgError.style.display = 'block';
    }
  } catch (err) {
    msgError.textContent = "Error applying coupon. Try again.";
    msgError.style.display = 'block';
    console.error(err);
  }
});

document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
  radio.addEventListener('change', function() {
    console.log('✅ Payment method changed to:', this.value);
    
    const walletRow = document.getElementById('walletPayable');
    const amountEl = document.getElementById('walletPayableAmount');
    const walletBalanceDisplay = document.getElementById('walletBalanceDisplay');
    
    if (this.value === 'wallet') {
      const total = parseFloat(document.getElementById('grandTotalDisplay').textContent.replace(/,/g, ''));
      const walletBalance = parseFloat(walletBalanceDisplay?.textContent.replace(/[^0-9.]/g, '') || '0');
      
      console.log('Wallet Balance:', walletBalance, 'Required:', total);
      
      amountEl.textContent = total.toLocaleString('en-IN');
      walletRow.style.display = 'flex';
      
      if (walletBalance < total) {
        toast(`Insufficient wallet balance. Available: ₹${walletBalance.toLocaleString('en-IN')}, Required: ₹${total.toLocaleString('en-IN')}`, "error");
      }
    } else {
      walletRow.style.display = 'none';
    }
  });
});

document.getElementById('placeOrderBtn')?.addEventListener('click', async function() {
  console.log('🔵 Place Order Button Clicked');
  
  const selectedAddress = document.querySelector('input[name="selectedAddress"]:checked')?.value;
  const paymentMethodInput = document.querySelector('input[name="paymentMethod"]:checked');
  const paymentMethod = paymentMethodInput?.value;
  const appliedDiscount = this.dataset.discount || 0;
  const appliedCoupon = this.dataset.appliedCoupon || null;

  console.log('=== Order Debug Info ===');
  console.log('Selected Address:', selectedAddress);
  console.log('Payment Input Element:', paymentMethodInput);
  console.log('Payment Method Value:', paymentMethod);
  console.log('Applied Discount:', appliedDiscount);
  console.log('Applied Coupon:', appliedCoupon);
  
  const allPaymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
  console.log('Total payment radios found:', allPaymentRadios.length);
  allPaymentRadios.forEach((radio, i) => {
    console.log(`Radio ${i}:`, radio.value, 'checked:', radio.checked);
  });

  if (!selectedAddress) {
    toast("Please select a delivery address", "error");
    return;
  }
  
  if (!paymentMethod) {
    toast("Please select a payment method", "error");
    console.error('❌ Payment method is undefined/null');
    return;
  }

  const subtotal = parseFloat(document.getElementById('subtotalDisplay').textContent.replace(/,/g, ''));
  const shipping = subtotal < 15000 ? 100 : 0;
  const finalAmount = subtotal + shipping - appliedDiscount;

  if (paymentMethod === 'wallet') {
    const walletBalanceDisplay = document.getElementById('walletBalanceDisplay');
    const walletBalance = parseFloat(walletBalanceDisplay?.textContent.replace(/[^0-9.]/g, '') || '0');
    
    if (walletBalance < finalAmount) {
      toast(`Insufficient wallet balance. Available: ₹${walletBalance.toLocaleString('en-IN')}, Required: ₹${finalAmount.toLocaleString('en-IN')}`, "error");
      return;
    }
  }

  sessionStorage.setItem('checkoutSummary', JSON.stringify({
    subtotal,
    shipping,
    discount: appliedDiscount,
    totalAmount: finalAmount
  }));

  this.disabled = true;
  const originalText = this.textContent;
  this.textContent = 'Processing...';

  if (paymentMethod === "razorpay") {
    if (typeof Razorpay === 'undefined') {
      toast("Payment gateway not loaded. Please refresh the page.", "error");
      this.disabled = false;
      this.textContent = originalText;
      return;
    }

    try {
      const orderResponse = await axios.post('/create-order', { amount: finalAmount });

      if (!orderResponse.data.success) {
        throw new Error(orderResponse.data.message || "Failed to create payment order");
      }

      const { order_id, amount, key_id } = orderResponse.data;

      const options = {
        key: key_id,
        amount: amount,
        currency: "INR",
        name: "Chronora",
        description: "Luxury Watch Purchase",
        image: "/images/logo.png",
        order_id: order_id,
        handler: async function (response) {
          try {
            const placeOrderRes = await axios.post('/checkout/place-order', {
              selectedAddress,
              paymentMethod: "razorpay",
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
            console.error('Order placement error:', err);
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
          ondismiss: function () {
            toast("Payment cancelled by user", "error");
            this.disabled = false;
            this.textContent = originalText;
            window.location.href = `/checkout/failure?error=${encodeURIComponent("Payment was cancelled")}`;
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response) {
        toast("Payment failed: " + (response.error.description || "Unknown error"), "error");
        this.disabled = false;
        this.textContent = originalText;
        window.location.href = `/checkout/failure?error=${encodeURIComponent(response.error.description || "Payment declined")}`;
      });

      rzp.open();

    } catch (err) {
      console.error("Razorpay initiation error:", err);
      toast("Failed to start payment. Please try again.", "error");
      this.disabled = false;
      this.textContent = originalText;
      window.location.href = `/checkout/failure?error=${encodeURIComponent("Unable to connect to payment gateway")}`;
    }
  } else {
    try {
      console.log('📤 Sending order data:', {
        selectedAddress,
        paymentMethod,
        discount: appliedDiscount,
        appliedCoupon
      });

      const res = await axios.post('/checkout/place-order', {
        selectedAddress,
        paymentMethod,
        discount: appliedDiscount,
        appliedCoupon
      });

      console.log('📥 Server response:', res.data);

      if (res.data.success) {
        toast("Order placed successfully!", "success");
        sessionStorage.removeItem('checkoutSummary');
        setTimeout(() => window.location.href = res.data.redirect, 800);
      } else {
        toast(res.data.message || "Order failed", "error");
        this.disabled = false;
        this.textContent = originalText;
        window.location.href = `/checkout/failure?error=${encodeURIComponent(res.data.message || "Order could not be placed")}`;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Something went wrong. Please try again.";
      toast(errorMessage, "error");
      console.error('❌ Order error:', err);
      console.error('Error response:', err.response?.data);
      this.disabled = false;
      this.textContent = originalText;
    }
  }
});