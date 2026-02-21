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
        background: type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#2ecc71',
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

  // Close modal when clicking on backdrop or close button
  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => hideModal(el.dataset.close));
  });

  // Track and Invoice buttons
  document.getElementById('btnTrack')?.addEventListener('click', () => showModal('modalTrack'));
  document.getElementById('btnInvoice')?.addEventListener('click', () => showModal('modalInvoice'));

  // Cancel button - Check status before opening modal
  document.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      try {
        // First check if item is already cancelled
        const checkResponse = await fetch(`/profile/orders/${orderId}/check-cancel?itemIndex=${itemIndex}`);
        
        if (checkResponse.ok) {
          const data = await checkResponse.json();
          
          if (data.isAlreadyCancelled) {
            toast('This item has already been cancelled', 'error');
            setTimeout(() => window.location.reload(), 2000);
            return;
          }
          
          if (!data.isCancellable) {
            toast(`Cannot cancel - Status: ${data.currentStatus}`, 'error');
            return;
          }
        }
        
        // If check passes or fails, open modal (actual request will handle errors)
        showModal('modalCancel');
        
      } catch (error) {
        console.error('Error checking cancellable status:', error);
        // If API fails, just open the modal and let the actual request handle it
        showModal('modalCancel');
      }
    });
  });

  // Confirm Cancel button
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

    // Disable button to prevent double submission
    confirmBtn.disabled = true;
    const originalText = confirmBtn.textContent;
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

      // Handle non-200 responses
      if (!response.ok) {
        // Check for "already cancelled" message
        if (response.status === 400 && data.message?.toLowerCase().includes('already cancelled')) {
          toast('This item has already been cancelled', 'error');
          hideModal('modalCancel');
          setTimeout(() => window.location.reload(), 2000);
          return;
        }
        throw new Error(data.message || 'Failed to cancel item');
      }

      // Success
      toast(data.message || 'Item cancelled successfully', 'success');
      hideModal('modalCancel');
      
      // Redirect to orders page after success
      setTimeout(() => {
        window.location.href = '/profile/orders';
      }, 1500);

    } catch (error) {
      console.error('Cancel error:', error);
      
      // Check if error message indicates already cancelled
      if (error.message?.toLowerCase().includes('already cancelled')) {
        toast('This item has already been cancelled', 'error');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast(error.message || 'Network error. Please try again.', 'error');
      }
    } finally {
      // Re-enable button
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalText;
    }
  });

  // Return button
  document.querySelectorAll('.btn-return').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showModal('modalReturn');
    });
  });

  // Submit Return button
  document.getElementById('submitReturn')?.addEventListener('click', async () => {
    const submitBtn = document.getElementById('submitReturn');

    const reason = document.querySelector('input[name="returnReason"]:checked')?.value;
    const refundMethod = document.getElementById('refundMethod')?.value;

    if (!reason) {
      return toast('Please select a return reason', 'error');
    }

    // Disable button
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
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
      submitBtn.textContent = originalText;
    }
  });

  // Review button
  document.querySelectorAll('.btn-review').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Reset review form
      const ratingInput = document.getElementById('ratingValue');
      if (ratingInput) ratingInput.value = 0;
      
      document.querySelectorAll('#modalReview .star').forEach(s => {
        s.textContent = '☆';
        s.style.color = '#e2e8f0';
      });
      
      const ratingTextEl = document.getElementById('ratingText');
      if (ratingTextEl) ratingTextEl.textContent = 'Tap a star to rate';
      
      const reviewText = document.getElementById('reviewText');
      if (reviewText) reviewText.value = '';
      
      const submitBtn = document.getElementById('submitReview');
      if (submitBtn) submitBtn.disabled = true;

      showModal('modalReview');
    });
  });

  // Star rating functionality
  const stars = document.querySelectorAll('#modalReview .star');
  const ratingInput = document.getElementById('ratingValue');
  const ratingTextEl = document.getElementById('ratingText');
  const submitReviewBtn = document.getElementById('submitReview');
  const reviewText = document.getElementById('reviewText');

  if (stars.length > 0) {
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const rating = parseInt(star.dataset.rating);
        
        if (ratingInput) ratingInput.value = rating;

        // Update star colors
        stars.forEach((s, i) => {
          if (i < rating) {
            s.textContent = '★';
            s.style.color = '#fbbf24';
          } else {
            s.textContent = '☆';
            s.style.color = '#e2e8f0';
          }
        });

        // Update rating text
        const texts = ["", "Very Bad", "Poor", "Average", "Good", "Excellent!"];
        if (ratingTextEl) ratingTextEl.textContent = texts[rating];

        // Enable submit button if both rating and text are present
        if (submitReviewBtn && reviewText) {
          const hasText = reviewText.value.trim().length > 0;
          submitReviewBtn.disabled = !(rating > 0 && hasText);
        }
      });
    });
  }

  // Review text input - enable/disable submit button
  if (reviewText && submitReviewBtn && ratingInput) {
    reviewText.addEventListener('input', () => {
      const hasText = reviewText.value.trim().length > 0;
      const hasRating = parseInt(ratingInput.value || '0') > 0;
      submitReviewBtn.disabled = !(hasText && hasRating);
    });
  }

  // Submit Review button
  submitReviewBtn?.addEventListener('click', async () => {
    const rating = ratingInput?.value || '0';
    const title = document.getElementById('reviewTitle')?.value.trim();
    const text = reviewText?.value.trim();

    if (!rating || rating === '0') {
      return toast('Please select a rating', 'error');
    }
    
    if (!text) {
      return toast('Please write your review', 'error');
    }

    // Disable button
    submitReviewBtn.disabled = true;
    const originalText = submitReviewBtn.textContent;
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

      toast('Review submitted successfully! 🎉', 'success');
      hideModal('modalReview');
      
      setTimeout(() => location.reload(), 1500);

    } catch (error) {
      console.error('Review error:', error);
      toast(error.message || 'Failed to submit review', 'error');
    } finally {
      submitReviewBtn.disabled = false;
      submitReviewBtn.textContent = originalText;
    }
  });

  // Handle "Other" reason for cancellation
  const cancelRadios = document.querySelectorAll('input[name="cancelReason"]');
  const otherReasonContainer = document.getElementById('otherReasonContainer');
  
  if (cancelRadios.length > 0 && otherReasonContainer) {
    cancelRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        otherReasonContainer.style.display = radio.value === 'Other' ? 'block' : 'none';
        
        // Clear other reason input when not selected
        if (radio.value !== 'Other') {
          const otherInput = document.getElementById('otherCancelReason');
          if (otherInput) otherInput.value = '';
        }
      });
    });
  }

  document.getElementById('downloadPDF')?.addEventListener('click', async () => {
    try {
      window.open(`/profile/orders/${orderId}/invoice`, '_blank');
      toast('Downloading invoice...', 'success');
    } catch (error) {
      console.error('Download error:', error);
      toast('Failed to download invoice', 'error');
    }
  });

  document.getElementById('emailInvoice')?.addEventListener('click', () => {
    toast('Email invoice feature coming soon', 'info');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
    console.log('Page became visible, checking for updates...');
    }
  });
});