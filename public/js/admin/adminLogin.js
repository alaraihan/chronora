const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const btnText = loginBtn.querySelector(".btn-text");
const btnLoading = loginBtn.querySelector(".btn-loading");


const showToast = (message, isSuccess = true) => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
  });
  Toast.fire({
    icon: isSuccess ? 'success' : 'error',
    title: message
  });
};

const validate = () => {
  let valid = true;


  if (!emailInput.value.trim() || !emailInput.value.includes("@")) {
    document.getElementById("email-error").textContent = "Enter a valid email";
    valid = false;
  } else {
    document.getElementById("email-error").textContent = "";
  }


  if (passwordInput.value.length < 6) {
    document.getElementById("password-error").textContent = "Password must be 6+ characters";
    valid = false;
  } else {
    document.getElementById("password-error").textContent = "";
  }

  return valid;
};


form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!validate()) return;


  loginBtn.disabled = true;
  btnText.style.display = "none";
  btnLoading.style.display = "inline";

  try {
    const response = await axios.post("/admin/login", {
      email: emailInput.value.trim(),
      password: passwordInput.value
    });

    showToast(response.data.message || "Welcome back!", true);
    setTimeout(() => {
      window.location.href = "/admin/dashboard";
    }, 800);

  } catch (error) {
    const msg = error.response?.data?.message || "Login failed. Try again.";
    showToast(msg, false);


    loginBtn.disabled = false;
    btnText.style.display = "inline";
    btnLoading.style.display = "none";
  }
});
