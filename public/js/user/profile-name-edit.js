const form = document.getElementById("edit-name-form");

form.addEventListener("submit", async (e) => {
  e.preventDefault(); 

  const fullName = document.getElementById("fullName").value.trim();

  if (!fullName) {
    Toastify({
      text: "Please enter a name!",
      backgroundColor: "linear-gradient(to right, #FF5F6D, #FFC371)",
      duration: 3000,
    }).showToast();
    return;
  }

  try {
    const response = await axios.post("/profile/edit/name", { fullName });

    if (response.data.success) {
      Toastify({
        text: response.data.message,
        backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)",
        duration: 3000,
      }).showToast();

      setTimeout(() => {
        window.location.href = "/profile";
      }, 1500);
    } else {
      Toastify({
        text: response.data.message,
        backgroundColor: "linear-gradient(to right, #FF5F6D, #FFC371)",
        duration: 3000,
      }).showToast();
    }
  } catch (error) {
    Toastify({
      text: "Something went wrong!",
      backgroundColor: "linear-gradient(to right, #FF5F6D, #FFC371)",
      duration: 3000,
    }).showToast();
    console.error(error);
  }
});
