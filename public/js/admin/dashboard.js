const overlay = document.getElementById("loadingOverlay");
let salesChart = null;
let statusChart = null;

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

function formatCurrency(amount) {
  return amount.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

function updateOverviewCards(overview) {
  document.getElementById('totalOrders').textContent = overview.totalOrders.toLocaleString('en-IN');
  document.getElementById('totalRevenue').textContent = '₹' + formatCurrency(overview.totalRevenue);
  document.getElementById('totalUsers').textContent = overview.totalUsers.toLocaleString('en-IN');
  document.getElementById('totalProducts').textContent = overview.totalProducts.toLocaleString('en-IN');
}

function renderSalesChart(salesData) {
  const ctx = document.getElementById('salesChart').getContext('2d');
  
  if (salesChart) {
    salesChart.destroy();
  }

  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: salesData.map(d => d.date),
      datasets: [
        {
          label: 'Revenue (₹)',
          data: salesData.map(d => d.revenue),
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Orders',
          data: salesData.map(d => d.orders),
          borderColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                if (context.datasetIndex === 0) {
                  label += '₹' + context.parsed.y.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  });
                } else {
                  label += context.parsed.y;
                }
              }
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Revenue (₹)'
          },
          ticks: {
            callback: function(value) {
              return '₹' + value.toLocaleString('en-IN');
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Orders'
          },
          grid: {
            drawOnChartArea: false,
          }
        }
      }
    }
  });
}

function renderStatusChart(statusData) {
  const ctx = document.getElementById('statusChart').getContext('2d');
  
  if (statusChart) {
    statusChart.destroy();
  }

  const colors = {
    'Pending': '#FFC107',
    'Confirmed': '#2196F3',
    'Processing': '#9C27B0',
    'Shipped': '#FF9800',
    'Out for Delivery': '#FF5722',
    'Delivered': '#4CAF50',
    'Cancelled': '#F44336',
    'Returned': '#795548',
    'Partially Delivered': '#00BCD4',
    'Partially Cancelled': '#E91E63',
    'Partially Returned': '#607D8B'
  };

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: statusData.map(s => s._id),
      datasets: [{
        data: statusData.map(s => s.count),
        backgroundColor: statusData.map(s => colors[s._id] || '#9E9E9E'),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 15,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recentOrdersBody');
  tbody.innerHTML = '';

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:30px; color:#888;">
          No recent orders
        </td>
      </tr>
    `;
    return;
  }

  orders.forEach(order => {
    const row = document.createElement('tr');
    
    const statusClass = getStatusClass(order.status);
    const date = new Date(order.date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    row.innerHTML = `
      <td><strong>${order.orderId}</strong></td>
      <td>${order.customer}</td>
      <td>₹${formatCurrency(order.amount)}</td>
      <td><span class="status-badge ${statusClass}">${order.status}</span></td>
      <td>${date}</td>
    `;
    tbody.appendChild(row);
  });
}

function getStatusClass(status) {
  const statusMap = {
    'Pending': 'status-pending',
    'Confirmed': 'status-confirmed',
    'Processing': 'status-processing',
    'Shipped': 'status-shipped',
    'Delivered': 'status-delivered',
    'Cancelled': 'status-cancelled',
    'Returned': 'status-returned'
  };
  return statusMap[status] || 'status-default';
}

function renderTopProducts(products) {
  const container = document.getElementById('topProductsList');
  container.innerHTML = '';

  if (!products || products.length === 0) {
    container.innerHTML = '<p style="text-align:center; padding:30px; color:#888;">No data available</p>';
    return;
  }

  products.forEach((product, index) => {
    const item = document.createElement('div');
    item.className = 'top-product-item';
    item.innerHTML = `
      <div class="product-rank">#${index + 1}</div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        <div class="product-stats">
          <span><i class="bi bi-box"></i> ${product.totalSold} units sold</span>
          <span><i class="bi bi-currency-rupee"></i> ₹${formatCurrency(product.revenue)}</span>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function renderPaymentMethods(payments) {
  const container = document.getElementById('paymentGrid');
  container.innerHTML = '';

  if (!payments || payments.length === 0) {
    container.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No payment data</p>';
    return;
  }

  const paymentIcons = {
    'razorpay': 'bi-credit-card',
    'cod': 'bi-cash-coin',
    'wallet': 'bi-wallet2'
  };

  const paymentColors = {
    'razorpay': '#5469d4',
    'cod': '#28a745',
    'wallet': '#ff9800'
  };

  payments.forEach(payment => {
    const method = payment._id || 'unknown';
    const icon = paymentIcons[method] || 'bi-question-circle';
    const color = paymentColors[method] || '#6c757d';

    const item = document.createElement('div');
    item.className = 'payment-method-item';
    item.style.borderColor = color;
    item.innerHTML = `
      <div class="payment-icon" style="background-color: ${color};">
        <i class="bi ${icon}"></i>
      </div>
      <div class="payment-details">
        <h6>${method.toUpperCase()}</h6>
        <p class="payment-count">${payment.count} orders</p>
        <p class="payment-revenue">₹${formatCurrency(payment.revenue)}</p>
      </div>
    `;
    container.appendChild(item);
  });
}

function loadDashboardData() {
  showLoading();

  axios.get('/admin/dashboard/data')
    .then(response => {
      if (!response.data.success) {
        toast("Failed to load dashboard data", "error");
        return;
      }

      const data = response.data;
      
      updateOverviewCards(data.overview);
      renderSalesChart(data.salesChartData);
      renderStatusChart(data.statusDistribution);
      renderRecentOrders(data.recentOrders);
      renderTopProducts(data.topProducts);
      renderPaymentMethods(data.paymentDistribution);
    })
    .catch(error => {
      console.error("Dashboard load error:", error);
      toast("Error loading dashboard data", "error");
    })
    .finally(() => hideLoading());
}

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();
});