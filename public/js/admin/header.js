document.addEventListener("DOMContentLoaded", function () {
  const profileBtn = document.getElementById("profileDropdown");
  const profileMenu = document.getElementById("profileMenu");

  // Toggle profile dropdown
  profileBtn.addEventListener("click", function () {
    profileMenu.classList.toggle("show");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", function (e) {
    if (!profileBtn.contains(e.target)) {
      profileMenu.classList.remove("show");
    }
  });
});