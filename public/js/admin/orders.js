
    const params = new URLSearchParams(window.location.search);
    const overlay = document.getElementById("loadingOverlay");

    function showLoading() {
        if (overlay) overlay.style.display = "flex";
    }

    function hideLoading() {
        if (overlay) overlay.style.display = "none";
    }

    function toast(message, type = "error") {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "bottom",
            position: "right",
            backgroundColor: type === "success" ? "#28a745" : "#dc3545"
        }).showToast();
    }

    function applyFilters() {
        const searchInput = document.getElementById("searchInput");
        const statusSelect = document.getElementById("statusFilter");

        const search = searchInput?.value.trim();
        const status = statusSelect?.value;

        params.set("page", "1"); 

        if (search) {
            params.set("search", search);
        } else {
            params.delete("search");
        }

        if (status) {
            params.set("status", status);
        } else {
            params.delete("status");
        }

        updateURLAndLoad();
    }

    function goToPage(page) {
        params.set("page", page);
        updateURLAndLoad();
    }

    function updateURLAndLoad() {
        const newUrl = `/admin/orders?${params.toString()}`;
        window.history.pushState({}, "", newUrl);
        loadOrders();
    }

    function loadOrders() {
        showLoading();

        axios.get(`/admin/orders?${params.toString()}`, {
            headers: { Accept: "application/json" }
        })
        .then(response => {
            const data = response.data;

            if (!data.success) {
                toast("Failed to load orders", "error");
                return;
            }

            const lineItems = [];
            data.orders.forEach(order => {
                if (order.products && order.products.length > 0) {
                    order.products.forEach(prod => {
                        lineItems.push({
                            orderId: order.orderId || "N/A",
                            order_id: order._id,
                            shortId: order._id.toString().slice(-6),
                            createdAt: order.createdAt,
                            customerName: order.address?.fullName || order.userId?.name || "Guest",
                            customerContact: order.address?.phone || order.userId?.email || "",
                            status: order.status || "Pending",
                            product: prod
                        });
                    });
                }
            });

            renderLineItems(lineItems);
            renderPagination(data.pagination);
        })
        .catch(error => {
            console.error("Load orders error:", error);
            toast("Server error while loading orders", "error");
        })
        .finally(() => {
            hideLoading();
        });
    }

    function renderLineItems(items) {
        const tbody = document.getElementById("ordersTableBody");

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-5">
                        <i class="bi bi-inbox" style="font-size: 3rem; opacity: 0.5;"></i>
                        <h4>No products found</h4>
                        <p>No matching orders or products with current filters.</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = items.map(item => {
            const prod = item.product;

            const productName = 
                prod.productId?.name || 
                prod.product?.name || 
                "Unknown Product";

            const variantObj = prod.variantId || prod.variant;
            const variantInfo = [];
            if (variantObj?.colorName) variantInfo.push(variantObj.colorName);
            if (variantObj?.size) variantInfo.push(variantObj.size);
            const variant = variantInfo.length ? ` (${variantInfo.join(" - ")})` : "";

            const price = prod.price || prod.productId?.price || prod.product?.price || 0;
            const qty = prod.quantity || 1;
            const subtotal = price * qty;

            const statusClass = item.status.toLowerCase().replace(/ /g, '-');

            return `
                <tr>
                    <td><strong>#${item.orderId}</strong><br><small class="text-muted">${item.shortId}</small></td>
                    <td><strong>${item.customerName}</strong><br><small>${item.customerContact}</small></td>
                    <td>
                        ${new Date(item.createdAt).toLocaleDateString("en-IN")}<br>
                        <small>${new Date(item.createdAt).toLocaleTimeString("en-IN", {hour: "2-digit", minute: "2-digit"})}</small>
                    </td>
                    <td><strong>${productName}${variant}</strong></td>
                    <td class="text-center">${qty}</td>
                    <td class="text-end">₹${price.toFixed(2)}</td>
                    <td class="text-end">₹${subtotal.toFixed(2)}</td>
                    <td><span class="status-badge status-${statusClass}">${item.status}</span></td>
                    <td>
                        <div class="action-buttons">
                            <a href="/admin/orders/${item.order_id}" class="btn-action btn-view" title="View Order">
                                <i class="bi bi-eye"></i>
                            </a>
                            <a href="/admin/orders/print/${item.order_id}" target="_blank" class="btn-action btn-print" title="Print Invoice">
                                <i class="bi bi-printer"></i>
                            </a>
                        </div>
                    </td>
                </tr>`;
        }).join("");
    }

    function renderPagination(pag) {
        const container = document.getElementById("paginationContainer");

        if (!pag || pag.totalPages <= 1) {
            container.innerHTML = "";
            return;
        }

        let html = "";

        if (pag.currentPage > 1) {
            html += `<a href="javascript:goToPage(${pag.currentPage - 1})" class="page-link prev">
                        <i class="bi bi-chevron-left"></i> Previous
                     </a>`;
        }

        html += '<div class="page-numbers">';
        for (let i = 1; i <= pag.totalPages; i++) {
            if (i === pag.currentPage) {
                html += `<span class="page-number active">${i}</span>`;
            } else {
                html += `<a href="javascript:goToPage(${i})" class="page-number">${i}</a>`;
            }
        }
        html += '</div>';

        if (pag.currentPage < pag.totalPages) {
            html += `<a href="javascript:goToPage(${pag.currentPage + 1})" class="page-link next">
                        Next <i class="bi bi-chevron-right"></i>
                     </a>`;
        }

        container.innerHTML = html;
    }

    document.getElementById("searchInput")?.addEventListener("keypress", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            applyFilters();
        }
    });

    document.getElementById("statusFilter")?.addEventListener("change", () => {
        applyFilters();
    });

    document.addEventListener("DOMContentLoaded", () => {
        loadOrders();
    });
