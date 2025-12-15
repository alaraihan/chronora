    document.getElementById('profileBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('dropdownMenu').classList.toggle('show');
    });
    document.addEventListener('click', () => {
      const menu = document.getElementById('dropdownMenu');
      if (menu && menu.classList.contains('show')) menu.classList.remove('show');
    });
const profileImgInput = document.querySelector("#profile-image-input");
const profilePreview = document.querySelector("#profile-preview");

if (profileImgInput) {
  profileImgInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      profilePreview.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const newPass = document.querySelector("#new-password");
const confirmPass = document.querySelector("#confirm-password");
const passError = document.querySelector("#password-error");

function checkPasswordMatch() {
  if (newPass && confirmPass && passError) {
    if (confirmPass.value !== newPass.value) {
      passError.textContent = "Passwords do not match!";
      passError.style.display = "block";
    } else {
      passError.style.display = "none";
    }
  }
}

if (confirmPass) {
  confirmPass.addEventListener("keyup", checkPasswordMatch);
}
