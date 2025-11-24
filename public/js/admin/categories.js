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

  document.querySelectorAll(".btn-delete").forEach(btn => {
    btn.onclick = () => {
      const row = btn.closest("tr");
      document.querySelector("#deleteForm [name='id']").value = row.dataset.id;
      document.getElementById("deleteCategoryName").textContent = row.dataset.name;
      document.getElementById("actionText").textContent = row.dataset.deleted === "true" ? "restore" : "delete";
    };
  });

  document.getElementById("addForm").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await axios.post("/admin/categories", fd);
      showToast("Added!");
    } catch (err) {
      showToast("Failed", "error");
    }
  };

  document.getElementById("editForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = e.target.querySelector("[name='id']").value;
    const fd = new FormData(e.target);
    try {
      await axios.patch(`/admin/categories/${id}`, fd);
      showToast("Updated!");
    } catch (err) {
      showToast("Update failed", "error");
    }
  };
  document.getElementById("deleteForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = e.target.querySelector("[name='id']").value;
    console.log(id);
    try {
      const res =  await axios.patch(`/admin/categories/delete/${id}`);
      console.log(res);

      showToast("Done!");
    } catch (err) {
      showToast("Failed", "error");
    }
  };
});