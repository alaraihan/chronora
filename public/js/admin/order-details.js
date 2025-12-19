const ORDER_ID = window.ORDER_ID;


function showToast(message, type = 'info') {
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };

    if (!window.Toastify) {
        alert(message);
        return;
    }

    Toastify({
        text: message,
        duration: 3000,
        gravity: "bottom",
        position: "right",
        backgroundColor: colors[type]
    }).showToast();
}


function approveItemReturn(itemIndex) {
    axios.post(`/admin/orders/${window.ORDER_ID}/return/approve`, {
        itemIndex
    })
    .then(res => {
        Toastify({
            text: res.data.message || "Return approved",
            backgroundColor: "#28a745",
            duration: 3000
        }).showToast();

        location.reload();
    })
    .catch(err => {
        console.error(err.response?.data || err.message);
        Toastify({
            text: "Server error",
            backgroundColor: "#dc3545",
            duration: 3000
        }).showToast();
    });
}

function rejectItemReturn(itemIndex) {
    axios.post(`/admin/orders/${window.ORDER_ID}/return/reject`, {
        itemIndex
    })
    .then(res => {
        Toastify({
            text: res.data.message || "Return rejected",
            backgroundColor: "#ffc107",
            duration: 3000
        }).showToast();

        location.reload();
    })
    .catch(err => {
        console.error(err.response?.data || err.message);
        Toastify({
            text: "Server error",
            backgroundColor: "#dc3545",
            duration: 3000
        }).showToast();
    });
}

function updateItemStatusUI(index, status) {
    const card = document.querySelector(`.item-card[data-index="${index}"]`);
    if (!card) return;

    let badge = card.querySelector('.status-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'status-badge';
        card.querySelector('.item-details').prepend(badge);
    }

    badge.textContent = status;
    badge.className = `status-badge status-${status.toLowerCase().replace(/ /g, '-')}`;
}

function removeReturnButtons(index) {
    const card = document.querySelector(`.item-card[data-index="${index}"]`);
    card?.querySelector('.return-actions')?.remove();
}
