const sidebar = document.querySelector(".sidebar");
const sidebarOverlay = document.querySelector(".sidebar-overlay");
const sidebarToggleBtn = document.querySelector("#open-sidebar-btn");
const sidebarCloseBtn = document.querySelector("#close-sidebar-btn");

function openSidebar() {
  sidebar.classList.add("active");
  sidebarOverlay.classList.add("active");
  document.body.style.overflow = "hidden"; 
}

function closeSidebar() {
  sidebar.classList.remove("active");
  sidebarOverlay.classList.remove("active");
  document.body.style.overflow = "auto";
}

if (sidebarToggleBtn) {
  sidebarToggleBtn.addEventListener("click", openSidebar);
}

if (sidebarCloseBtn) {
  sidebarCloseBtn.addEventListener("click", closeSidebar);
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener("click", closeSidebar);
}
