
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
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".block-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.getAttribute("data-user-id");

      if (!userId) {
        Toastify({
          text: "User ID missing!",
          backgroundColor: "#e74c3c",
        }).showToast();
        return;
      }

      try {
        const response = await axios.patch(`/admin/customers/toggle-block/${userId}`);

     if (!response.data.success) {
  Toastify({
    text: response.data.message,
    backgroundColor: "#e74c3c",
    duration: 3000,
    gravity: "bottom",
    position: "right",
  }).showToast();
  return;
}


        const isBlocked = response.data.isBlocked;
        document.getElementById(`status-${userId}`).textContent = isBlocked ? "Blocked" : "Active";
                btn.textContent = isBlocked ? "Unblock" : "Block";
        Toastify({
          text: isBlocked ? "User blocked successfully" : "User unblocked successfully",
          backgroundColor: isBlocked ? "#c0392b" : "#27ae60",
          duration: 3000,
          gravity: "bottom",
          position: "right",
        }).showToast();

      } catch (error) {
        console.error("Toggle block error:", error);
        Toastify({
          text: error.response?.data?.message || "Server error. Please try again.",
          backgroundColor: "#e74c3c",
          duration: 3000,
          gravity: "bottom",
          position: "right",
        }).showToast();
      }
    });
  });
});