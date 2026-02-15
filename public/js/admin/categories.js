
const searchInput = document.querySelector('input[name="search"]');
let debounceTimeout;

searchInput?.addEventListener('input', function () {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        document.getElementById('searchForm').submit();
    }, 600);
});

document.querySelectorAll('.clear-search').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/admin/categories';
    });
});

function previewImage(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('currentLogoImg');
    const container = document.getElementById('currentLogo');
    if (file) {
        const reader = new FileReader();
        reader.onload = ev => { preview.src = ev.target.result; container.style.display = 'block'; };
        reader.readAsDataURL(file);
    } else {
        preview.src = ''; container.style.display = 'none';
    }
}

function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Add Category';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('currentLogo').style.display = 'none';
}

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

async function openEditModal(id) {
    try {
        const { data } = await axios.get(`/admin/categories/${id}`);
        const c = data.category;

        document.getElementById('modalTitle').textContent = 'Edit Category';
        document.getElementById('categoryId').value = c._id;
        document.getElementById('categoryName').value = c.name;
        document.getElementById('categoryDescription').value = c.description || '';
        document.getElementById('categoryStatus').value = c.isListed;

        const logoUrl =
  typeof c.image === 'string'
    ? c.image
    : c.image?.url || '';

const logoContainer = document.getElementById('currentLogo');
const logoImg = document.getElementById('currentLogoImg');

if (logoUrl) {
  logoImg.src = logoUrl;
  logoContainer.style.display = 'block';
} else {
  logoImg.src = '';
  logoContainer.style.display = 'none';
}


        new bootstrap.Modal(document.getElementById('categoryModal')).show();
    } catch (err) {
        showToast('Failed to load category', 'error');
    }
}

async function saveCategory() {
    const id = document.getElementById('categoryId').value;
    const formData = new FormData();
    formData.append('name', document.getElementById('categoryName').value.trim());
    formData.append('description', document.getElementById('categoryDescription').value.trim());
    formData.append('isListed', document.getElementById('categoryStatus').value);
    if (document.getElementById('categoryLogo').files[0]) {
        formData.append('logo', document.getElementById('categoryLogo').files[0]);
    }

    try {
        if (id) {
            await axios.put(`/admin/categories/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        } else {
            await axios.post('/admin/categories', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
        showToast('Saved!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
        setTimeout(() => location.reload(), 600);
    } catch (err) {
        showToast(err.response?.data?.message || 'Save failed', 'error');
    }
}

async function toggleCategoryStatus(categoryId, currentListed) {
    try {
        await axios.patch(`/admin/categories/toggle/${categoryId}`);
        const row = document.querySelector(`tr[data-category-id="${categoryId}"]`);
        const badge = row.querySelector('.status-badge');
        const btn = row.querySelector('.action-buttons button:last-child');
        const newListed = !currentListed;

        badge.className = newListed ? 'status-badge status-active' : 'status-badge status-inactive';
        badge.textContent = newListed ? 'Listed' : 'Unlisted';
        btn.className = newListed ? 'btn btn-sm btn-success' : 'btn btn-sm btn-secondary';
        btn.textContent = newListed ? 'Listed' : 'Unlisted';
        btn.onclick = () => toggleCategoryStatus(categoryId, newListed);

        showToast(`Category ${newListed ? 'listed' : 'unlisted'}!`, 'success');
    } catch (err) {
        showToast('Failed to update', 'error');
    }
}
let cropper = null;
let currentFile = null;

document.getElementById('categoryLogo').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    currentFile = file;
    const reader = new FileReader();
    reader.onload = function (ev) {
        document.getElementById('logoPreview').src = ev.target.result;
        document.getElementById('logoPreviewContainer').style.display = 'block';
        document.getElementById('currentLogo').style.display = 'none'; // Hide old one
    };
    reader.readAsDataURL(file);
});

function openCropper() {
    if (!currentFile) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = document.getElementById('imageToCrop');
        img.src = e.target.result;

        const modal = new bootstrap.Modal(document.getElementById('cropperModal'));
        modal.show();

        document.getElementById('cropperModal').addEventListener('shown.bs.modal', function initCropper() {
            if (cropper) cropper.destroy();
            cropper = new Cropper(img, {
                aspectRatio: 1,
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 0.9,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
            this.removeEventListener('shown.bs.modal', initCropper);
        });
    };
    reader.readAsDataURL(currentFile);
}

document.getElementById('cropDoneBtn').addEventListener('click', function () {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({
        width: 400,
        height: 400,
        imageSmoothingQuality: 'high'
    });

    const croppedBase64 = canvas.toDataURL('image/webp', 0.85);

    document.getElementById('croppedLogo').value = croppedBase64;


    document.getElementById('logoPreview').src = croppedBase64;


    bootstrap.Modal.getInstance(document.getElementById('cropperModal')).hide();
});

document.getElementById('cropperModal').addEventListener('hidden.bs.modal', function () {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
});

const originalSaveCategory = saveCategory;
async function saveCategory() {
    const croppedLogo = document.getElementById('croppedLogo').value;
    const originalFile = document.getElementById('categoryLogo').files[0];

    const formData = new FormData();
    formData.append('name', document.getElementById('categoryName').value.trim());
    formData.append('description', document.getElementById('categoryDescription').value.trim());
    formData.append('isListed', document.getElementById('categoryStatus').value);

    if (croppedLogo) {
        const byteString = atob(croppedLogo.split(',')[1]);
        const mimeString = croppedLogo.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        formData.append('logo', blob, 'cropped-logo.webp');
    } else if (originalFile) {
        formData.append('logo', originalFile);
    }

    const id = document.getElementById('categoryId').value;

    try {
        if (id) {
            await axios.put(`/admin/categories/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        } else {
            await axios.post('/admin/categories', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
        showToast('Category saved successfully!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
        setTimeout(() => location.reload(), 600);
    } catch (err) {
        showToast(err.response?.data?.message || 'Save failed', 'error');
    }
}
