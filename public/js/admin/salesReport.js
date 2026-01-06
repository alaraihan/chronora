
const params = new URLSearchParams(window.location.search);
const overlay = document.getElementById("loadingOverlay");

function showLoading() { 
  overlay.style.display = "flex"; 
}

function hideLoading() { 
  overlay.style.display = "none"; 
}

function toast(message, type = "error") {
  Toastify({
    text: message,
    duration: 3000,
    gravity: "bottom",
    position: "right",
    backgroundColor: type === "success" ? "#28a745" : "#dc3545",
    stopOnFocus: true,
    close: true
  }).showToast();
}

function applyFilters() {
  const search = document.getElementById("searchInput").value.trim();
  const dateFrom = document.getElementById("dateFrom").value;
  const dateTo = document.getElementById("dateTo").value;

  if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
    toast("'Date From' cannot be later than 'Date To'", "error");
    return;
  }

  params.set("page", "1");
  if (search) {
    params.set("search", search);
  } else {
    params.delete("search");
  }
  
  if (dateFrom) {
    params.set("dateFrom", dateFrom);
  } else {
    params.delete("dateFrom");
  }
  
  if (dateTo) {
    params.set("dateTo", dateTo);
  } else {
    params.delete("dateTo");
  }

  updateURLAndLoad();
}

function clearFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";
  
  params.delete("search");
  params.delete("dateFrom");
  params.delete("dateTo");
  params.set("page", "1");
  
  updateURLAndLoad();
}

function goToPage(page) {
  params.set("page", page);
  updateURLAndLoad();
}

function updateURLAndLoad() {
  window.history.replaceState({}, "", `/admin/sales-report?${params.toString()}`);
  loadSalesData();
}

function updateSummary(summary) {
  const totalOrders = summary.totalOrders || 0;
  const totalRevenue = summary.totalRevenue || 0;
  const totalDiscount = summary.totalDiscount || 0;
  const totalItemsSold = summary.totalItemsSold || 0;

  document.getElementById("totalOrders").textContent = totalOrders.toLocaleString('en-IN');
  document.getElementById("totalRevenue").textContent = `₹${totalRevenue.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
  document.getElementById("totalDiscount").textContent = `₹${totalDiscount.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
  document.getElementById("totalItemsSold").textContent = totalItemsSold.toLocaleString('en-IN');
}

function renderTable(lineItems) {
  const tbody = document.getElementById("salesTableBody");
  tbody.innerHTML = "";

  if (!lineItems || lineItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:50px; color:#888; font-size:1.1rem;">
          <i class="bi bi-inbox" style="font-size:3rem; display:block; margin-bottom:10px;"></i>
          No delivered items found
        </td>
      </tr>
    `;
    return;
  }

  lineItems.forEach(item => {
    const row = document.createElement("tr");
    
    const orderDate = new Date(item.orderDate).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });

    const customerName = item.customer?.fullName || item.customer?.email || 'Guest';

    const productName = item.productName || 'Unknown Product';
    const variantInfo = item.variantInfo || '';

    const unitPrice = (item.price || 0).toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
    const lineTotal = (item.lineTotal || 0).toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });

    const paymentMethod = (item.paymentMethod || 'N/A').toUpperCase();

    row.innerHTML = `
      <td>${orderDate}</td>
      <td><strong>${item.orderId}</strong></td>
      <td>${customerName}</td>
      <td>
        <div>
          <div><strong>${productName}</strong></div>
          ${variantInfo ? `<small style="color:#666;">${variantInfo}</small>` : ''}
        </div>
      </td>
      <td style="text-align:center;">${item.quantity}</td>
      <td>₹${unitPrice}</td>
      <td style="font-weight:bold; color:#28a745;">
        ₹${lineTotal}
      </td>
      <td><span class="payment-badge">${paymentMethod}</span></td>
    `;
    tbody.appendChild(row);
  });
}

function renderPagination(pag) {
  const container = document.getElementById("paginationContainer");
  container.innerHTML = "";

  if (!pag || pag.totalPages <= 1) return;

  let html = '<div style="display:flex; justify-content:center; align-items:center; gap:15px; margin-top:30px;">';

  if (pag.currentPage > 1) {
    html += `<button onclick="goToPage(${pag.currentPage - 1})" class="btn btn-secondary">
      <i class="bi bi-chevron-left"></i> Previous
    </button>`;
  }

  html += `<span style="font-weight:bold; font-size:1.1rem;">
    Page ${pag.currentPage} of ${pag.totalPages}
  </span>`;

  if (pag.currentPage < pag.totalPages) {
    html += `<button onclick="goToPage(${pag.currentPage + 1})" class="btn btn-primary">
      Next <i class="bi bi-chevron-right"></i>
    </button>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

function loadSalesData() {
  showLoading();

  axios.get(`/admin/sales-report/data?${params.toString()}`)
    .then(response => {
      if (!response.data.success) {
        toast("Failed to load sales data", "error");
        return;
      }

      const data = response.data;
      
      updateSummary(data.summary || {});
      
      renderTable(data.lineItems || []);
      
      renderPagination(data.pagination || {});
    })
    .catch(error => {
      console.error("Load error:", error);
      
      if (error.response) {
        toast(`Error: ${error.response.data.message || 'Failed to load data'}`, "error");
      } else if (error.request) {
        toast("No response from server. Please check your connection.", "error");
      } else {
        toast("Error loading data from server", "error");
      }
    })
    .finally(() => {
      hideLoading();
    });
}

function downloadReport() {
  showLoading();
  
  axios.get(`/admin/sales-report/download?${params.toString()}`, {
    responseType: 'blob'
  })
    .then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const filename = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast("Report downloaded successfully!", "success");
    })
    .catch(error => {
      console.error("Download error:", error);
      
      if (error.response) {
        toast(`Download failed: ${error.response.data.message || 'Unknown error'}`, "error");
      } else {
        toast("Error downloading report. Please try again.", "error");
      }
    })
    .finally(() => {
      hideLoading();
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const searchVal = params.get("search");
  const dateFromVal = params.get("dateFrom");
  const dateToVal = params.get("dateTo");

  if (searchVal) {
    document.getElementById("searchInput").value = searchVal;
  }
  if (dateFromVal) {
    document.getElementById("dateFrom").value = dateFromVal;
  }
  if (dateToVal) {
    document.getElementById("dateTo").value = dateToVal;
  }

  loadSalesData();

  document.getElementById("searchInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      applyFilters();
    }
  });
});