
document.addEventListener("DOMContentLoaded", function () {
    const passwordInput = document.getElementById("password");
    const toggleButton = document.querySelector(".toggle-pass");
    const eyeIcon = toggleButton.querySelector("i");

    toggleButton.addEventListener("click", function () {
        // Toggle the type attribute
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            eyeIcon.classList.remove("fa-eye");
            eyeIcon.classList.add("fa-eye-slash");
            toggleButton.setAttribute("aria-label", "Hide password");
        } else {
            passwordInput.type = "password";
            eyeIcon.classList.remove("fa-eye-slash");
            eyeIcon.classList.add("fa-eye");
            toggleButton.setAttribute("aria-label", "Show password");
        }
    });
});
const emailId=document.getElementById("email");
  const passwordId=document.getElementById("password");
  
  function validateEmail(){
    const emailValue=emailId.value.trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
    if (!ok) showError("email", "Please enter a valid email");
  else hideError("email");
  return ok;
  }

  function validatePassword() {
  const ok = passwordInput.value.trim() !== "";
  if (!ok) showError("password", "Password cannot be empty");
  else hideError("password");
  return ok;
}

emailInput.addEventListener("input", validateEmail);
passwordInput.addEventListener("input", validatePassword);


form.addEventListener("submit",(e)=>{
  if(!validateEmail||!validatePassword){
    e.preventDefault();
  }
})
