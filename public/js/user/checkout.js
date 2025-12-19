const toast = (msg, type = "success") => {
  Toastify({
    text: msg,
    duration: 3000,
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
      this.querySelector('input[type="radio"]').checked = true;
    });
  });
}

attachAddressClickListeners();
attachPaymentClickListeners();

document.getElementById('placeOrderBtn')?.addEventListener('click', async () => {
  const selectedAddress = document.querySelector('input[name="selectedAddress"]:checked')?.value;
  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;

  if (!selectedAddress) {
    return toast("Please select a delivery address", "error");
  }
  if (!paymentMethod) {
    return toast("Please select a payment method", "error");
  }

  try {
    const res = await axios.post('/checkout/place-order', {
      selectedAddress,   
      payment: paymentMethod
    });

    if (res.data.success) {
      toast("Order placed successfully!", "success");
      window.location.href = res.data.redirect || '/orders';
    } else {
      toast(res.data.message || "Order failed", "error");
    }
  } catch (err) {
    toast("Something went wrong", "error");
    console.error(err);
  }
});