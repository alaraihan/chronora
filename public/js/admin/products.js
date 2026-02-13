
let variants = [];
let currentCropper = null;
let currentCropVariantIndex = null;

function showToast(msg, type = 'success') {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
    Toast.fire({
        icon: type,
        title: msg
    });
}

function showConfirm(message = 'Are you sure?') {
    return Swal.fire({
        title: 'Confirmation',
        text: message,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes',
        cancelButtonText: 'Cancel'
    }).then((result) => result.isConfirmed);
}

function createCropperModal() {
    if (document.getElementById('cropperModal')) return;

    const modal = document.createElement('div');
    modal.id = 'cropperModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <span class="close-btn" onclick="closeCropperModal()">×</span>
            <h2>Crop Image</h2>
            <div style="max-height: 500px; overflow: hidden; background: #f3f4f6; display: flex; align-items: center; justify-content: center;">
                <img id="cropperImage" style="max-width: 100%; display: block;">
            </div>
            <div class="modal-actions" style="margin-top: 20px;">
                <button type="button" class="btn-primary" style="background:#6b7280;" onclick="closeCropperModal()">Cancel</button>
                <button type="button" class="btn-primary" onclick="applyCrop()">Apply Crop</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function openCropperModal(file, variantIndex) {
    createCropperModal();

    currentCropVariantIndex = variantIndex;
    const modal = document.getElementById('cropperModal');
    const img = document.getElementById('cropperImage');

    const url = URL.createObjectURL(file);
    img.src = url;

    modal.style.display = 'block';

    if (currentCropper) {
        currentCropper.destroy();
    }

    img.onload = function () {
        currentCropper = new Cropper(img, {
            aspectRatio: 1,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.8,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    };
}

function closeCropperModal() {
    const modal = document.getElementById('cropperModal');
    if (modal) {
        modal.style.display = 'none';
    }

    if (currentCropper) {
        currentCropper.destroy();
        currentCropper = null;
    }

    currentCropVariantIndex = null;


    const img = document.getElementById('cropperImage');
    if (img && img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
    }
}

function applyCrop() {
    if (!currentCropper || currentCropVariantIndex === null) return;


    const canvas = currentCropper.getCroppedCanvas({
        width: 800,
        height: 800,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    });

    canvas.toBlob((blob) => {
        if (!blob) {
            showToast('Failed to crop image', 'error');
            return;
        }

        const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });

        const reader = new FileReader();
        reader.onload = (e) => {
            const variantIndex = currentCropVariantIndex;

            if (variants[variantIndex].images.length < 5) {
                variants[variantIndex].images.push(e.target.result);
                if (!variants[variantIndex].newFiles) {
                    variants[variantIndex].newFiles = [];
                }
                variants[variantIndex].newFiles.push(file);
                renderVariants();
                showToast('Image cropped and added!', 'success');
            } else {
                showToast('Maximum 5 images per variant', 'warning');
            }

            closeCropperModal();
        };
        reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.9);
}

function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Add New Product';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    variants = [{ id: null, name: '', stock: 0, strapColor: "", images: [], newFiles: [] }];
    renderVariants();
    updateCalculatedStock();
    document.getElementById('productModal').style.display = 'block';
}

async function openEditModal(id) {
    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = id;

    try {
        const res = await axios.get(`/admin/products/get/${id}`);
        if (!res.data.success) throw new Error(res.data.message || 'Failed to load');

        const p = res.data.data;
        document.getElementById('name').value = p.name || '';
        document.getElementById('description').value = p.description || '';
        document.getElementById('price').value = p.price != null ? p.price : '';
        document.getElementById('category').value = p.category || '';


        variants = (p.variants || []).map(v => ({
            id: v.id || v.variantId || v.variantId?.toString() || null,
            name: v.name || v.colorName || '',
            stock: v.stock || 0,
            images: Array.isArray(v.images) ? v.images.slice() : [],
            strapColor: v.strapColor,
            newFiles: []
        }));

        if (variants.length === 0) {
            variants.push({ id: null, name: '', stock: 0, strapColor: "", images: [], newFiles: [] });
        }

        renderVariants();
        updateCalculatedStock();
        document.getElementById('productModal').style.display = 'block';
    } catch (err) {
        console.error('Edit modal load error', err);
        showToast(err.response?.data?.message || err.message || 'Failed to load product', 'error');
    }
}

function closeModal() {
    document.getElementById('productModal').style.display = 'none';
    variants = [];
}

function renderVariants() {
    const container = document.getElementById('variantsContainer');
    if (!container) return;

    container.innerHTML = '';

    variants.forEach((v, i) => {
        const div = document.createElement('div');
        div.className = 'variant-row';

        const imagesHtml = (v.images || []).map(img => `
            <div style="position:relative;display:inline-block;margin:4px;">
                <img src="${img}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid #e5e7eb;">
                <button type="button" class="remove-image-btn" 
                        data-variant="${i}" 
                        data-img="${encodeURIComponent(img)}"
                        style="position:absolute;top:-8px;right:-8px;background:#ef4444;color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;line-height:1;padding:0;">×</button>
            </div>
        `).join('');

        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <strong>Variant ${i + 1} - ${escapeHtml(v.name) || 'New'}</strong>
                ${variants.length > 1 ? `<button type="button" onclick="removeVariant(${i})" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px;">Remove</button>` : ''}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <label style="display:block;margin-bottom:6px;font-weight:500;">Variant Name</label>
                    <input type="text" value="${escapeHtml(v.name)}" 
                           onchange="variants[${i}].name=this.value;renderVariants();"
                           style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                </div>
                <div>
                    <label style="display:block;margin-bottom:6px;font-weight:500;">Stock</label>
                    <input type="number" value="${v.stock}" min="0"
                           onchange="variants[${i}].stock=+this.value;updateCalculatedStock();"
                           style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                </div>
                  <div>
                    <label style="display:block;margin-bottom:6px;font-weight:500;">StrapColor</label>
                    <input type="text" value="${v.strapColor}"
                           onchange="variants[${i}].strapColor=this.value;renderVariants()"
                           style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                </div>
            </div>
            <div style="margin-top:12px;">
                <label style="display:block;margin-bottom:8px;font-weight:500;">Images (${v.images?.length || 0}/5)</label>
                <div style="margin-bottom:10px;">
                    ${imagesHtml || '<p style="color:#6b7280;font-size:14px;">No images</p>'}
                </div>
                <label class="btn-primary" style="display:inline-block;padding:8px 16px;font-size:14px;cursor:pointer;">
                    + Add Images (Max 5)
                    <input type="file" accept="image/*" multiple style="display:none;" 
                           onchange="handleImages(this.files, ${i})">
                </label>
            </div>
        `;

        container.appendChild(div);
    });

    container.querySelectorAll('.remove-image-btn').forEach(btn => {
        btn.onclick = (e) => {
            const vi = Number(btn.dataset.variant);
            const img = decodeURIComponent(btn.dataset.img);
            removeExistingImage(vi, img);
        };
    });

    updateCalculatedStock();
}

function handleImages(files, variantIndex) {
    const remaining = 5 - (variants[variantIndex].images?.length || 0);
    if (remaining <= 0) {
        showToast('Maximum 5 images per variant', 'warning');
        return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);

    if (filesToProcess.length > 0) {
        openCropperModal(filesToProcess[0], variantIndex);

        if (filesToProcess.length > 1) {
            setTimeout(() => {
                processRemainingFiles(filesToProcess.slice(1), variantIndex);
            }, 100);
        }
    }
}

function processRemainingFiles(files, variantIndex) {
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (variants[variantIndex].images.length < 5) {
                variants[variantIndex].images.push(e.target.result);
                if (!variants[variantIndex].newFiles) {
                    variants[variantIndex].newFiles = [];
                }
                variants[variantIndex].newFiles.push(file);
                renderVariants();
            }
        };
        reader.readAsDataURL(file);
    });
}

function removeExistingImage(variantIndex, imgUrl) {
    const idx = variants[variantIndex].images.indexOf(imgUrl);
    if (idx > -1) {
        variants[variantIndex].images.splice(idx, 1);
        if (variants[variantIndex].newFiles && variants[variantIndex].newFiles.length > 0) {
            variants[variantIndex].newFiles.pop();
        }
        renderVariants();
    }
}

function addVariant() {
    if (variants.length >= 8) {
        showToast('Max 8 variants', 'warning');
        return;
    }
    variants.push({ id: null, name: '', stock: 0, strapColor: "", images: [], newFiles: [] });
    renderVariants();
}

function removeVariant(i) {
    if (variants.length === 1) {
        showToast('Need at least one variant', 'warning');
        return;
    }
    variants.splice(i, 1);
    renderVariants();
}

function updateCalculatedStock() {
    const total = variants.reduce((s, v) => s + (+v.stock || 0), 0);
    const el = document.getElementById('calculatedStock');
    if (el) el.value = total;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"'`=\/]/g, function (s) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": "&#39;",
            '/': '&#x2F;'
        }[s]);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('productForm');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();

            const id = document.getElementById('productId').value || '';
            const isEdit = !!id;

            if (!document.getElementById('category').value) {
                showToast('Select category', 'warning');
                return;
            }

            const fd = new FormData();
            fd.append('name', document.getElementById('name').value.trim());
            fd.append('description', document.getElementById('description').value.trim());
            fd.append('price', document.getElementById('price').value);
            fd.append('category', document.getElementById('category').value);

            const payload = variants.map(v => {
                const existingImages = (v.images || []).filter(img =>
                    typeof img === 'string' && !img.startsWith('data:')
                );
                return {
                    id: v.id || null,
                    name: v.name || '',
                    stock: v.stock || 0,
                    strapColor: v.strapColor,
                    existingImages,
                    newImageCount: (v.newFiles || []).length
                };
            });

            fd.append('variants', JSON.stringify(payload));

            variants.forEach(v => {
                (v.newFiles || []).forEach(f => fd.append('images', f));
            });

            const btn = document.getElementById('saveBtn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Saving...';
            }

            try {
                const url = isEdit ? `/admin/products/edit/${id}` : '/admin/products/add';
                const method = isEdit ? 'put' : 'post';
                const res = await axios({
                    method,
                    url,
                    data: fd,
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                showToast(res.data.message || 'Saved!', 'success');
                setTimeout(() => location.reload(), 700);
            } catch (err) {
                console.error('Submit error', err);
                showToast(err.response?.data?.message || err.message || 'Save failed', 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Save Product';
                }
            }
        };
    }

    window.searchProducts = () => {
        const q = document.getElementById('searchInput')?.value.trim() || '';
        location.href = `/admin/products${q ? '?search=' + encodeURIComponent(q) : ''}`;
    };

    document.getElementById('searchInput')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') searchProducts();
    });

    window.toggleBlock = async (id, blocked) => {
        const ok = await showConfirm(blocked ? 'Unblock this product?' : 'Block this product?');
        if (!ok) return;

        try {
            const res = await axios.put(`/admin/products/block/${id}`, {
                action: blocked ? 'unblock' : 'block'
            });
            showToast(res.data?.message || 'Status updated', 'success');
            setTimeout(() => location.reload(), 700);
        } catch (err) {
            console.error('Toggle block error', err);
            showToast('Failed to update', 'error');
        }
    };
});

window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.closeModal = closeModal;
window.closeCropperModal = closeCropperModal;
window.applyCrop = applyCrop;
window.addVariant = addVariant;
window.removeVariant = removeVariant;