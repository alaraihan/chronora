
function handleSearch() {
  const searchValue = document.getElementById("brand-search-input").value.trim();
  const url = new URL(window.location);

  if (searchValue) {
    url.searchParams.set("search", searchValue);
  } else {
    url.searchParams.delete("search");
  }
  url.searchParams.set("page", 1);
  window.location.href = url.toString();
}

function clearSearch() {
  const url = new URL(window.location);
  url.searchParams.delete("search");
  url.searchParams.set("page", 1);
  window.location.href = url.toString();
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
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".block-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.getAttribute("data-user-id");

      if (!userId) {
        showToast("User ID missing!", "error");
        return;
      }

      // Determine current action
      const action = btn.textContent.trim(); // "Block" or "Unblock"
      const isBlocking = action === "Block";

      // Show confirmation modal with color based on action
      const result = await Swal.fire({
        title: isBlocking 
          ? "Are you sure you want to block this user?" 
          : "Are you sure you want to unblock this user?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: action,
        cancelButtonText: "Cancel",
        reverseButtons: true,
        confirmButtonColor: isBlocking ? "#dc2626" : "#16a34a" // Red for block, green for unblock
      });

      if (!result.isConfirmed) return; // User cancelled

      try {
        const response = await axios.patch(`/admin/customers/toggle-block/${userId}`);

        if (!response.data.success) {
          showToast(response.data.message, "error");
          return;
        }

        const isBlocked = response.data.isBlocked;
        document.getElementById(`status-${userId}`).textContent = isBlocked ? "Blocked" : "Active";
        btn.textContent = isBlocked ? "Unblock" : "Block";

        showToast(
          isBlocked ? "User blocked successfully" : "User unblocked successfully",
          isBlocked ? "error" : "success" 
        );

      } catch (error) {
        console.error("Toggle block error:", error);
        showToast(error.response?.data?.message || "Server error. Please try again.", "error");
      }
    });
  });
});
