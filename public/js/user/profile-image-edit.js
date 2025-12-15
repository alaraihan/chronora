function showToast(message, type = "success") {
  let bgColor;
  if (type === "success") bgColor = "linear-gradient(to right, #00b09b, #96c93d)";
  else if (type === "error") bgColor = "linear-gradient(to right, #e74c3c, #c0392b)";
  else bgColor = "linear-gradient(to right, #3498db, #2980b9)";

  Toastify({ text: message, backgroundColor: bgColor, duration: 3000 }).showToast();
}

const form = document.querySelector(".edit-form");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) preview.src = URL.createObjectURL(file);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!fileInput.files.length) return showToast("Please select an image!", "error");

  const formData = new FormData();
  formData.append("profileImage", fileInput.files[0]);

  try {
    const res = await axios.post("/profile/edit/image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (res.data.success) {
      showToast(res.data.message, "success");
      preview.src = res.data.image + "?t=" + new Date().getTime();

      const sidebarImg = document.querySelector(".sidebar .profile-img");
      if (sidebarImg) sidebarImg.src = res.data.image + "?t=" + new Date().getTime();
    }
  } catch (err) {
    showToast(err.response?.data?.message || "Something went wrong", "error");
  }
});
