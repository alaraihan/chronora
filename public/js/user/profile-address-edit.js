
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.style.display = 'flex';           
  modal.classList.remove('show');         
  setTimeout(() => modal.classList.add('show'), 10); 
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300); 
}
function openAddModal() {
  document.getElementById('addForm').reset();
  openModal('addModal');
}

function openEditModal(id) {
  axios.get(`/profile/addresses/${id}/edit`)
    .then(res => {
      if (res.data.success) {
        const a = res.data.address;

        document.getElementById('edit_id').value = a._id;
        document.getElementById('edit_name').value = a.name || '';
        document.getElementById('edit_phone').value = a.phone || '';
        document.getElementById('edit_street').value = a.street || '';
        document.getElementById('edit_city').value = a.city || '';
        document.getElementById('edit_state').value = a.state || '';
        document.getElementById('edit_zip').value = a.zip || '';
        document.getElementById('edit_country').value = a.country || 'India';

        document.getElementById('edit_defaultShipping').checked = !!a.isDefaultShipping;
        document.getElementById('edit_defaultBilling').checked = !!a.isDefaultBilling;

        openModal('editModal');  
      } else {
        Toastify({ text: res.data.message || "Address not found", backgroundColor: "#e74c3c" }).showToast();
      }
    })
    .catch(err => {
      console.error("Edit load error:", err);
      Toastify({ text: "Failed to load address", backgroundColor: "#e74c3c" }).showToast();
    });
}

let addressToDelete = null;

function deleteAddress(id) {
  addressToDelete = id;
  openModal('deleteModal');  
}

async function addAddress() {
  const data = {
    name: document.getElementById('add_name').value.trim(),
    phone: document.getElementById('add_phone').value.trim(),
    street: document.getElementById('add_street').value.trim(),
    city: document.getElementById('add_city').value.trim(),
    state: document.getElementById('add_state').value.trim(),
    zip: document.getElementById('add_zip').value.trim(),
    country: document.getElementById('add_country').value.trim() || 'India',
    isDefaultShipping: document.getElementById('add_defaultShipping').checked,
    isDefaultBilling: document.getElementById('add_defaultBilling').checked,
  };

  if (Object.values(data).some(v => v === '' && typeof v === 'string')) {
    return Toastify({ text: "Please fill all fields", backgroundColor: "#e74c3c" }).showToast();
  }

  try {
    const res = await axios.post('/profile/addresses/add', data);
    Toastify({ text: res.data.message || "Address added successfully!", backgroundColor: "#1DB954" }).showToast();
    closeModal('addModal');
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    Toastify({ text: err.response?.data?.message || "Failed to add address", backgroundColor: "#e74c3c" }).showToast();
  }
}

async function updateAddress() {
  const id = document.getElementById('edit_id').value;
  const data = {
    name: document.getElementById('edit_name').value.trim(),
    phone: document.getElementById('edit_phone').value.trim(),
    street: document.getElementById('edit_street').value.trim(),
    city: document.getElementById('edit_city').value.trim(),
    state: document.getElementById('edit_state').value.trim(),
    zip: document.getElementById('edit_zip').value.trim(),
    country: document.getElementById('edit_country').value.trim() || 'India',
    isDefaultShipping: document.getElementById('edit_defaultShipping').checked,
    isDefaultBilling: document.getElementById('edit_defaultBilling').checked,
  };

  try {
    const res = await axios.put(`/profile/addresses/${id}`, data);
    Toastify({ text: res.data.message || "Address updated!", backgroundColor: "#1DB954" }).showToast();
    closeModal('editModal');
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    Toastify({ text: err.response?.data?.message || "Update failed", backgroundColor: "#e74c3c" }).showToast();
  }
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async function () {
  if (!addressToDelete) return;

  try {
    await axios.delete(`/profile/addresses/${addressToDelete}`);

    const card = document.querySelector(`.address-box[data-id="${addressToDelete}"]`);
    if (card) {
      card.style.transition = 'all 0.5s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.remove();
        Toastify({ text: "Address deleted permanently!", backgroundColor: "#e74c3c" }).showToast();

        if (!document.querySelector('.address-box')) {
          setTimeout(() => location.reload(), 600);
        }
      }, 500);
    }

    closeModal('deleteModal');
    addressToDelete = null;

  } catch (err) {
    Toastify({ text: err.response?.data?.message || "Delete failed", backgroundColor: "#e74c3c" }).showToast();
  }
});

window.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal')) {
    closeModal(e.target.id);
  }
});