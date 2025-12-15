document.addEventListener('DOMContentLoaded', function () {
  console.log('Order Detail JS Loaded');

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'error' ? '#e74c3c' : '#2ecc71'};
      color: white;
      border-radius: 6px;
      z-index: 9999;
      font-weight: 500;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  const modals = {
    modalTrack: document.getElementById('modalTrack'),
    modalCancel: document.getElementById('modalCancel'),
    modalReturn: document.getElementById('modalReturn'),
    modalReview: document.getElementById('modalReview'),
    modalInvoice: document.getElementById('modalInvoice'),
    modalReorder: document.getElementById('modalReorder')
  };

  function showModal(id) {
    modals[id]?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function hideModal(id) {
    modals[id]?.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => hideModal(btn.dataset.close));
  });

  document.getElementById('btnTrack')?.addEventListener('click', () => showModal('modalTrack'));
  document.getElementById('btnCancel')?.addEventListener('click', () => showModal('modalCancel'));
  document.getElementById('btnReturn')?.addEventListener('click', () => showModal('modalReturn'));
  document.getElementById('btnReview')?.addEventListener('click', () => showModal('modalReview'));
  document.getElementById('btnInvoice')?.addEventListener('click', () => showModal('modalInvoice'));
  document.getElementById('btnReorder')?.addEventListener('click', () => showModal('modalReorder'));

  function getOrderId() {
    return document
      .querySelector('.order-header h1')
      ?.textContent.replace('Order ', '')
      .trim();
  }

  document.getElementById('confirmCancel')?.addEventListener('click', async function () {
    const reasonInput = document.querySelector('input[name="cancelReason"]:checked');
    if (!reasonInput) return showToast('Select a reason', 'error');

    let reason = reasonInput.value;
    if (reason === 'Other') {
      const other = document.getElementById('otherCancelReason').value.trim();
      if (!other) return showToast('Enter reason', 'error');
      reason = other;
    }

    try {
      const res = await fetch(`/profile/orders/${getOrderId()}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        hideModal('modalCancel');
        document.querySelector('.order-status').textContent = 'Cancelled';
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  });

  document.getElementById('submitReturn')?.addEventListener('click', async function () {
    const reasonInput = document.querySelector('input[name="returnReason"]:checked');
    const refundMethod = document.getElementById('refundMethod')?.value;

    if (!reasonInput) return showToast('Select return reason', 'error');

    try {
      const res = await fetch(`/profile/orders/${getOrderId()}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reasonInput.value,
          refundMethod
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        hideModal('modalReturn');
        document.querySelector('.order-status').textContent = 'Returned';
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  });

  const stars = document.querySelectorAll('.star');
  const ratingInput = document.getElementById('ratingValue');
  const submitReviewBtn = document.getElementById('submitReview');

  stars.forEach(star => {
    star.addEventListener('click', () => {
      const rating = star.dataset.rating;
      ratingInput.value = rating;
      stars.forEach((s, i) => (s.textContent = i < rating ? '★' : '☆'));
      submitReviewBtn.disabled = false;
    });
  });

  submitReviewBtn?.addEventListener('click', async function () {
    const rating = ratingInput.value;
    const title = document.getElementById('reviewTitle').value.trim();
    const text = document.getElementById('reviewText').value.trim();

    if (!rating || !text) {
      return showToast('Rating & review required', 'error');
    }

    try {
      const res = await fetch(`/profile/orders/${getOrderId()}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, title, text })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Review submitted');
        hideModal('modalReview');
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  });
});
