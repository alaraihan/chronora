function showToast(msg, type = "success") {
  Toastify({
    text: msg,
    duration: 3000,
    gravity: "top",
    position: "right",
    backgroundColor: type === "success" ? "#28a745" : "#dc3545"
  }).showToast();
}

document.addEventListener("DOMContentLoaded", () => {
  // Edit
  document.querySelectorAll(".btn-edit").forEach(btn => {
    btn.onclick = () => {
      const row = btn.closest("tr");
      document.querySelector("#editForm [name='id']").value = row.dataset.id;
      document.querySelector("#editForm [name='name']").value = row.dataset.name;
      document.querySelector("#editForm [name='description']").value = row.dataset.description || "";
      const img = document.getElementById("currentImage");
      img.src = row.dataset.image || "";
      img.style.display = row.dataset.image ? "block" : "none";
    };
  });

  // Delete/Restore
  document.querySelectorAll(".btn-delete").forEach(btn => {
    btn.onclick = () => {
      const row = btn.closest("tr");
      document.querySelector("#deleteForm [name='id']").value = row.dataset.id;
      document.getElementById("deleteCategoryName").textContent = row.dataset.name;
      document.getElementById("actionText").textContent = row.dataset.deleted === "true" ? "restore" : "delete";
    };
  });

  // ADD
  document.getElementById("addForm").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await axios.post("/admin/categories", fd);
      showToast("Added!");
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      showToast("Failed", "error");
    }
  };

  // EDIT
  document.getElementById("editForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = e.target.querySelector("[name='id']").value;
    const fd = new FormData(e.target);
    try {
      await axios.patch(`/admin/categories/${id}`, fd);
      showToast("Updated!");
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      showToast("Update failed", "error");
    }
  };

  // DELETE/RESTORE
  document.getElementById("deleteForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = e.target.querySelector("[name='id']").value;
    try {
      await axios.delete(`/admin/categories/${id}`);
      showToast("Done!");
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      showToast("Failed", "error");
    }
  };
});