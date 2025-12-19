document.addEventListener('DOMContentLoaded', function () {
  console.log('Order Detail Page Loaded - Single Item View');

  const orderIdElement = document.querySelector('.order-summary-header h1');
  if (!orderIdElement) {
    console.error('Order ID not found');
    return;
  }
  
  const orderId = orderIdElement.textContent.replace('Order ', '').trim();
  console.log('Order ID:', orderId);

  const itemIndex = window.ITEM_INDEX !== undefined ? window.ITEM_INDEX : 0;
  console.log('Item Index:', itemIndex);

  function toast(message, type = 'success') {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "bottom",
      position: "right",
      stopOnFocus: true,
      style: {
        background: type === 'error' ? '#e74c3c' : '#2ecc71',
        borderRadius: "8px",
        fontWeight: "500",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
      }
    }).showToast();
  }

  function showModal(id) {
    const modal = document.getElementById(id);
    if (modal && !modal.classList.contains('active')) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => hideModal(el.dataset.close));
  });

  document.getElementById('btnTrack')?.addEventListener('click', () => showModal('modalTrack'));
  document.getElementById('btnInvoice')?.addEventListener('click', () => showModal('modalInvoice'));

  document.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      showModal('modalCancel');
    });
  });

  document.getElementById('confirmCancel')?.addEventListener('click', async () => {
    const confirmBtn = document.getElementById('confirmCancel');

    let reason = document.querySelector('input[name="cancelReason"]:checked')?.value;
    if (!reason) {
      return toast('Please select a cancellation reason', 'error');
    }
    
    if (reason === 'Other') {
      const otherReason = document.getElementById('otherCancelReason')?.value.trim();
      if (!otherReason) {
        return toast('Please specify your reason', 'error');
      }
      reason = otherReason;
    }

=    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';

    try {
      console.log('Sending cancel request:', { itemIndexes: [itemIndex], reason });
      
      const response = await fetch(`/profile/orders/${orderId}/cancel-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemIndexes: [itemIndex],
          reason
        })
      });

      const data = await response.json();
      console.log('Cancel response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel item');
      }

      toast(data.message || 'Item cancelled successfully', 'success');
      hideModal('modalCancel');
      
      setTimeout(() => {
        window.location.href = '/profile/orders';
      }, 1500);

    } catch (error) {
      console.error('Cancel error:', error);
      toast(error.message || 'Network error. Please try again.', 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm Cancellation';
    }
  });

  document.querySelectorAll('.btn-return').forEach(btn => {
    btn.addEventListener('click', () => {
      showModal('modalReturn');
    });
  });

  document.getElementById('submitReturn')?.addEventListener('click', async () => {
    const submitBtn = document.getElementById('submitReturn');

    const reason = document.querySelector('input[name="returnReason"]:checked')?.value;
    const refundMethod = document.getElementById('refundMethod')?.value;

    if (!reason) {
      return toast('Please select a return reason', 'error');
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
      console.log('Sending return request:', { itemIndexes: [itemIndex], reason, refundMethod });
      
      const response = await fetch(`/profile/orders/${orderId}/return-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemIndexes: [itemIndex],
          reason,
          refundMethod
        })
      });

      const data = await response.json();
      console.log('Return response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit return request');
      }

      toast(data.message || 'Return request submitted successfully', 'success');
      hideModal('modalReturn');
      
      setTimeout(() => {
        window.location.href = '/profile/orders';
      }, 1500);

    } catch (error) {
      console.error('Return error:', error);
      toast(error.message || 'Network error. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Return Request';
    }
  });

  document.querySelectorAll('.btn-review').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('ratingValue').value = 0;
      document.querySelectorAll('#modalReview .star').forEach(s => s.textContent = '☆');
      const submitBtn = document.getElementById('submitReview');
      if (submitBtn) submitBtn.disabled = true;

      showModal('modalReview');
    });
  });

  const stars = document.querySelectorAll('#modalReview .star');
  const ratingInput = document.getElementById('ratingValue');
  const submitReviewBtn = document.getElementById('submitReview');

  stars.forEach(star => {
    star.addEventListener('click', () => {
      const rating = parseInt(star.dataset.rating);
      ratingInput.value = rating;

      stars.forEach((s, i) => {
        s.textContent = i < rating ? '★' : '☆';
      });

      if (submitReviewBtn) submitReviewBtn.disabled = false;
    });
  });

  submitReviewBtn?.addEventListener('click', async () => {
    const rating = ratingInput.value;
    const title = document.getElementById('reviewTitle')?.value.trim();
    const text = document.getElementById('reviewText')?.value.trim();

    if (!rating || rating === '0') {
      return toast('Please select a rating', 'error');
    }
    
    if (!text) {
      return toast('Please write a review', 'error');
    }

    submitReviewBtn.disabled = true;
    submitReviewBtn.textContent = 'Submitting...';

    try {
      console.log('Sending review:', { productIndex: itemIndex, rating, title, text });
      
      const response = await fetch(`/profile/orders/${orderId}/review-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIndex: parseInt(itemIndex),
          rating: parseInt(rating),
          title: title || null,
          text
        })
      });

      const data = await response.json();
      console.log('Review response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit review');
      }

      toast('Review submitted successfully!', 'success');
      hideModal('modalReview');
      
      setTimeout(() => location.reload(), 1500);

    } catch (error) {
      console.error('Review error:', error);
      toast(error.message || 'Failed to submit review', 'error');
    } finally {
      submitReviewBtn.disabled = false;
      submitReviewBtn.textContent = 'Submit Review';
    }
  });

  document.querySelectorAll('input[name="cancelReason"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const container = document.getElementById('otherReasonContainer');
      if (container) {
        container.style.display = radio.value === 'Other' ? 'block' : 'none';
      }
    });
  });

  document.getElementById('downloadPDF')?.addEventListener('click', async () => {
    try {
      window.open(`/profile/orders/${orderId}/invoice`, '_blank');
      toast('Downloading invoice...', 'success');
    } catch (error) {
      toast('Failed to download invoice', 'error');
    }
  });

  document.getElementById('emailInvoice')?.addEventListener('click', () => {
    toast('Email invoice feature coming soon', 'error');
  });
});