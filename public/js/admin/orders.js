
const params = new URLSearchParams(window.location.search);
const overlay = document.getElementById("loadingOverlay");

function showLoading() {
  if (overlay) overlay.style.display = "flex";
}

function hideLoading() {
  if (overlay) overlay.style.display = "none";
}

function toast(message, type = "success") {
  const colors = {
    success: "#28a745",
    error: "#dc3545",
    info: "#17a2b8"
  };

  Toastify({
    text: message,
    duration: 3000,
    gravity: "top",
    position: "right",
    backgroundColor: colors[type]
  }).showToast();
}


function applyFilters() {
  const search = document.getElementById("searchInput").value.trim();
  const status = document.getElementById("statusFilter").value;
  const limit  = document.getElementById("limitFilter").value;

  params.set("page", 1);
  params.set("limit", limit);

  search ? params.set("search", search) : params.delete("search");
  status ? params.set("status", status) : params.delete("status");

  loadOrders();
}


function resetFilters() {
  window.location.href = "/admin/orders";
}

function removeSearch() {
  params.delete("search");
  params.set("page", 1);
  loadOrders();
}

function removeStatus() {
  params.delete("status");
  params.set("page", 1);
  loadOrders();
}
function goToPage(page) {
  params.set("page", page);
  loadOrders();
}

function loadOrders() {
  showLoading();

  const url = `/admin/orders?${params.toString()}`;

  axios
    .get(url, { headers: { Accept: "application/json" } })
    .then(res => {
      if (!res.data.success) {
        toast("Failed to load orders", "error");
        return;
      }

      renderOrders(res.data.orders);
      updatePaginationInfo(res.data.pagination);
      loadStats();

      window.history.pushState({}, "", url);
    })
    .catch(() => {
      toast("Server error", "error");
    })
    .finally(() => {
      hideLoading();
    });
}

function renderOrders(orders) {
  const tbody = document.getElementById("ordersTableBody");

  if (!orders.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5">
          <div class="empty-state">
            <i class="bi bi-inbox"></i>
            <h4>No orders found</h4>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => `
    <tr>
      <td>
        <strong>${order.orderId}</strong>
        <small class="text-muted d-block">${order._id.slice(-6)}</small>
      </td>

      <td>
        <strong>${order.address?.fullName || order.userId?.name || "Guest"}</strong>
        <small class="d-block">${order.address?.phone || order.userId?.email || ""}</small>
      </td>

      <td>
        ${new Date(order.createdAt).toLocaleDateString("en-IN")}
        <br>
        <small>${new Date(order.createdAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</small>
      </td>

      <td>
        <strong>₹${order.totalAmount.toFixed(2)}</strong>
        <small class="d-block">${order.products.length} item(s)</small>
      </td>

      <td>
        <select onchange="updateStatus('${order._id}', this.value)">
          ${statusOptions(order.status)}
        </select>
      </td>

      <td>
        <a href="/admin/orders/${order._id}" class="btn-action btn-view">
          <i class="bi bi-eye"></i>
        </a>
        <a href="/admin/orders/print/${order._id}" target="_blank" class="btn-action btn-print">
          <i class="bi bi-printer"></i>
        </a>
      </td>
    </tr>
  `).join("");
}

function statusOptions(current) {
  const statuses = ["pending","processing","shipped","delivered","cancelled"];
  return statuses.map(s =>
    `<option value="${s}" ${s === current ? "selected" : ""}>${capitalize(s)}</option>`
  ).join("");
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}


function updateStatus(orderId, status) {
  axios
    .post(`/admin/orders/${orderId}/status`, { status })
    .then(res => {
      if (res.data.success) {
        toast("Order status updated");
        loadStats();
      } else {
        toast(res.data.message, "error");
      }
    })
    .catch(() => toast("Failed to update status", "error"));
}


function loadStats() {
  axios
    .get(`/admin/orders/stats?${params.toString()}`)
    .then(res => {
      if (!res.data.success) return;

      document.getElementById("totalOrders").innerText = res.data.stats.total;
      document.querySelector(".stat-pending h3").innerText = res.data.stats.pending;
      document.querySelector(".stat-delivered h3").innerText = res.data.stats.delivered;
      document.querySelector(".stat-revenue h3").innerText = `₹ ${res.data.stats.revenue}`;
    })
    .catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => {
  loadStats();
});
