function showToast(message, type = 'success') {
  const bgColor = {
    success: '#28a745',
    error: '#dc3545',
    info: '#17a2b8',
    warning: '#ffc107'
  }[type] || '#333';

  Toastify({
    text: message,
    duration: 4000,
    close: true,
    gravity: "bottom",
    position: "right",
    backgroundColor: bgColor,
    stopOnFocus: true,
  }).showToast();
}

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  if (!form || !emailInput || !passwordInput) {
    console.error("Form elements not found");
    return;
  }

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    e.stopPropagation();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
      showToast("Please fill in all the fields", 'error');
      return;
    }
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast("Please enter a valid email address", 'error');
      return;
    }
  

    const submitBtn = form.querySelector(".btn-login");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    try {
      const res = await axios.post("/login", {
        email,
        password,
        remember: form.querySelector("#remember")?.checked || false
      });

      if (res.data.success) {
        showToast(res.data.message || "Login successful!", 'success');
        setTimeout(() => {
          window.location.href = res.data.redirect || '/home';
        }, 1500);
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Something went wrong';
      showToast(msg, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
});
