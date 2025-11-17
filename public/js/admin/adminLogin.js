    const form = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    function showError(id, msg) {
      const error = document.getElementById(id + "-error");
      error.textContent = msg;
      error.style.display = "block";
    }

    function hideError(id) {
      const error = document.getElementById(id + "-error");
      if (error) error.style.display = "none";
    }

    function validateEmail() {
      const value = emailInput.value.trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!valid && value !== "") {
        showError("email", "Please enter a valid email");
        return false;
      } else {
        hideError("email");
        return true;
      }
    }

    function validatePassword() {
      const value = passwordInput.value;
      if (value === "") {
        showError("password", "Password is required");
        return false;
      } else if (value.length < 6) {
        showError("password", "Password must be at least 6 characters");
        return false;
      } else {
        hideError("password");
        return true;
      }
    }

    emailInput.addEventListener("blur", validateEmail);
    passwordInput.addEventListener("blur", validatePassword);

    form.addEventListener("submit", function(e) {
      const emailOk = validateEmail();
      const passOk = validatePassword();
      if (!emailOk || !passOk) {
        e.preventDefault();
      }
    });