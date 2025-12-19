import axios from "axios";

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
    const passwordInput = document.getElementById("password");
    const toggleButton = document.querySelector(".toggle-pass");
    const eyeIcon = toggleButton.querySelector("i");

    toggleButton.addEventListener("click", function () {
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
form.addEventListener("submit",async function(e){
  e.preventDefault();

  const email=emailInput.value.trim();
const password=passwordInput.value;
  
if(!email||!password){
  showToast("please fill in all the fields",'error');
  return;
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("Please enter a valid email", "error");
      return;
    }

    const submitBtn = form.querySelector(".btn-login");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    try{
 const res=await axios.post("/login",{
  email,
  password,
  remember: form.querySelector("#remember")?.checked || false
 });
 if(res.data.success){
   showToast("Login successful!",'success');
   setTimeout(()=>location.href='/home',1500);}
}catch(error){
const msg=error.response?.data?.message||'something went wrong';
showToast(msg,'error');
}finally{
  submitBtn.disabled = false;
      submitBtn.textContent = originalText;
}

});

