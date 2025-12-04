document.addEventListener('DOMContentLoaded', () => {
  try {
    const minus = document.getElementById('qtyMinus') || document.querySelector('.qty-btn.minus');
    const plus  = document.getElementById('qtyPlus')  || document.querySelector('.qty-btn.plus');
    let valueEl = document.getElementById('qtyValue');
    if (!valueEl) {
      valueEl = document.querySelector('#quantityBox span, .quantity-box span, .qty-value, span[data-role="qty"]');
    }

    if (!minus || !plus || !valueEl) {
      console.warn('Quantity elements missing. Expected ids: qtyMinus, qtyPlus, qtyValue.');
      console.warn('Found:', { minus, plus, valueEl });
      return;
    }

    valueEl.style.color = valueEl.style.color || '#111';
    valueEl.style.background = valueEl.style.background || '#fff';
    valueEl.style.minWidth = valueEl.style.minWidth || '36px';
    valueEl.style.display = valueEl.style.display || 'inline-block';
    valueEl.style.textAlign = 'center';
    valueEl.style.padding = valueEl.style.padding || '6px 0';
    valueEl.setAttribute('aria-live', 'polite');

    const wrapper = document.getElementById('quantityBox') || document.querySelector('.quantity-box');
    let count = 1;
    if (wrapper && wrapper.dataset && wrapper.dataset.initial) {
      const n = parseInt(wrapper.dataset.initial, 10);
      if (!isNaN(n) && n >= 1) count = n;
    }

    valueEl.textContent = String(count);

    const maxStock = wrapper && wrapper.dataset && wrapper.dataset.maxStock
      ? parseInt(wrapper.dataset.maxStock, 10) || Infinity
      : Infinity;

    function updateUI() {
      valueEl.textContent = String(count);
      valueEl.style.color = '#111';
      minus.disabled = count <= 1;
      plus.disabled = count >= maxStock;
      console.log('Quantity updated:', count);
    }

    minus.addEventListener('click', () => {
      if (count > 1) {
        count = count - 1;
        updateUI();
      }
    });

    plus.addEventListener('click', () => {
      if (count < maxStock) {
        count = count + 1;
        updateUI();
      }
    });

    let syncTimer = null;
    function startSync() {
      if (syncTimer) return;
      syncTimer = setInterval(() => {
        if (valueEl.textContent !== String(count)) {
          valueEl.textContent = String(count);
        }
      }, 300);
    }
    function stopSync() {
      if (syncTimer) clearInterval(syncTimer);
      syncTimer = null;
    }
    minus.addEventListener('mousedown', startSync);
    plus.addEventListener('mousedown', startSync);
    window.addEventListener('mouseup', stopSync);

    updateUI();
    console.log('Quantity selector ready. Initial:', count);
  } catch (err) {
    console.error('Quantity init error:', err);
  }
});
