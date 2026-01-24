function toast(msg, type = "info") {
  Toastify({
    text: msg,
    duration: 3000,
    gravity: "bottom",
    position: "right",
    backgroundColor: type === "success" ? "#16a34a" : "#dc2626"
  }).showToast();
}
document.addEventListener('DOMContentLoaded', () => {
  const wishlistCards = document.querySelectorAll('.wishlist-card');

  wishlistCards.forEach(card => {
    card.style.cursor = 'pointer'; // visual feedback

    card.addEventListener('click', (e) => {
      // Prevent click if user clicked on buttons (Move to Cart / Remove)
      if (e.target.closest('.btn-move-cart') || e.target.closest('.btn-remove')) {
        return; // let the buttons handle their own clicks
      }

      // Get product ID from data attribute (you already have it on buttons)
      const productId = card.querySelector('.btn-move-cart')?.dataset.productId;

      if (productId) {
        window.location.href = `/product/${productId}`;
      }
    });
  });
});
document.querySelectorAll('.btn-remove').forEach(btn => {
  btn.addEventListener('click', async () => {
    const productId = btn.dataset.productId;
    const variantId = btn.dataset.variantId;

    try {
      const res = await axios.post('/remove-wishlist', { productId, variantId });
      toast(res.data.message, res.data.success ? "success" : "error");
      if (res.data.success) {
        btn.closest('.wishlist-card').remove();
        if (document.querySelectorAll('.wishlist-card').length === 0) {
          location.reload(); 
        }
      }
    } catch (err) {
      toast("Error removing item", "error");
    }
  });
});

document.querySelectorAll('.btn-move-cart').forEach(btn => {
  btn.addEventListener('click', async () => {
    const productId = btn.dataset.productId;
    const variantId = btn.dataset.variantId;

    try {
      const res = await axios.post('/move-to-cart', { productId, variantId });
      toast(res.data.message, res.data.success ? "success" : "error");
      if (res.data.success) {
        btn.closest('.wishlist-card').remove();
        if (document.querySelectorAll('.wishlist-card').length === 0) {
          location.reload();
        }
      }
    } catch (err) {
      toast("Error moving to cart", "error");
    }
  });
});