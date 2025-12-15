
function showToast(message, type = 'info') {
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };

    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: colors[type] || colors.info,
        className: "toastify-custom"
    }).showToast();
}


const statusSelect = document.getElementById('newStatus');
if (statusSelect) {
    statusSelect.addEventListener('change', () => {
        const reasonField = document.getElementById('reasonField');
        if (reasonField) reasonField.style.display = 'none';
    });
}

function updateOrderStatus() {
    const newStatus = document.getElementById('newStatus').value;
    const reason = document.getElementById('reasonText').value;

    if (!newStatus) {
        showToast('Please select a status', 'warning');
        return;
    }

    if (!confirm(`Change order status to "${newStatus}"?`)) return;

    const btn = document.getElementById('updateBtn');
    const oldHTML = btn.innerHTML;
    btn.innerHTML = 'Updating...';
    btn.disabled = true;

    axios.post(`/admin/orders/${ORDER_ID}/status`, { status: newStatus, reason })
        .then(res => {
            if (res.data.success) {
                showToast(res.data.message, 'success');
                setTimeout(() => location.reload(), 1200);
            } else {
                showToast(res.data.message || 'Failed', 'error');
            }
        })
        .catch(() => showToast('Server error', 'error'))
        .finally(() => {
            btn.innerHTML = oldHTML;
            btn.disabled = false;
        });
}


function approveCancelRequest() {
    if (!confirm('Approve cancellation request?')) return;

    const reason = prompt('Reason (optional):') || 'Cancel approved by admin';

    axios.post(`/admin/orders/${ORDER_ID}/approve-cancel`, { reason })
        .then(res => {
            if (res.data.success) {
                showToast(res.data.message, 'success');
                setTimeout(() => location.reload(), 1200);
            }
        })
        .catch(() => showToast('Server error', 'error'));
}

function rejectCancelRequest() {
    if (!confirm('Reject cancellation request?')) return;

    const reason = prompt('Reason (optional):') || 'Cancel rejected by admin';

    axios.post(`/admin/orders/${ORDER_ID}/reject-cancel`, { reason })
        .then(res => {
            if (res.data.success) {
                showToast(res.data.message, 'success');
                setTimeout(() => location.reload(), 1200);
            }
        })
        .catch(() => showToast('Server error', 'error'));
}


function approveReturnRequest() {
    if (!confirm('Approve return request?')) return;

    const reason = prompt('Reason (optional):') || 'Return approved by admin';

    axios.post(`/admin/orders/${ORDER_ID}/approve-return`, { reason })
        .then(res => {
            if (res.data.success) {
                showToast(res.data.message, 'success');
                setTimeout(() => location.reload(), 1200);
            }
        })
        .catch(() => showToast('Server error', 'error'));
}

function markAsReturned() {
    if (!confirm("Mark this order as returned?")) return;

    axios.post(`/admin/orders/${ORDER_ID}/mark-returned`)
        .then(res => {
            if (res.data.success) {
                showToast("Order marked as returned", "success");
                setTimeout(() => location.reload(), 1500);
            } else {
                showToast(res.data.message || "Failed", "error");
            }
        })
        .catch(() => {
            showToast("Server error", "error");
        });
}

function rejectReturnRequest() {
    if (!confirm('Reject return request?')) return;

    const reason = prompt('Reason (optional):') || 'Return rejected by admin';

    axios.post(`/admin/orders/${ORDER_ID}/reject-return`, { reason })
        .then(res => {
            if (res.data.success) {
                showToast(res.data.message, 'success');
                setTimeout(() => location.reload(), 1200);
            }
        })
        .catch(() => showToast('Server error', 'error'));
}


function copyOrderId() {
    navigator.clipboard.writeText(ORDER_DISPLAY_ID)
        .then(() => showToast('Order ID copied', 'success'))
        .catch(() => showToast('Copy failed', 'error'));
}
