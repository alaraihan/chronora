document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.for;         
    const input = document.getElementById(targetId);

    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
      btn.style.color = '#e74c3c';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
      btn.style.color = '#3498db';
    }
  });
});

const elements = {
  name: document.getElementById('name'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  confirm: document.getElementById('confirm'),
  agree: document.getElementById('agree')
};

const errorDivs = {
  name: document.getElementById('nameError'),
  email: document.getElementById('emailError'),
  password: document.getElementById('passwordError'),
  confirm: document.getElementById('confirmError'),
  agree: document.getElementById('agreeError')
};

function showError(field, show) {
  if (errorDivs[field]) {
    errorDivs[field].style.display = show ? 'block' : 'none';
  }
}

function validateName() {
  const valid = elements.name.value.trim().length >= 2;
  showError('name', !valid);
  return valid;
}
async function checkDuplicateEmail(email) {
  try {
    const res = await fetch(`/check-email?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    return data.exists;
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function validateEmail() {
  const email = elements.email.value.trim();

  if (!elements.email.checkValidity()) {
    errorDivs.email.textContent = "Please enter a valid email address.";
    showError('email', true);
    return false;
  }

  const exists = await checkDuplicateEmail(email);

  if (exists) {
    showError('email', false); // hide inline error

    Swal.fire({
      icon: "error",
      title: "Email Exists",
      text: "User already exists with this email!",
      confirmButtonColor: "#e74c3c"
    });

    return false;
  }

  showError('email', false);
  return true;
}


function validatePassword() {
  const valid = elements.password.value.length >= 8;
  showError('password', !valid);
  return valid;
}

function validateConfirm() {
  const valid = elements.confirm.value === elements.password.value && elements.confirm.value !== '';
  showError('confirm', !valid);
  return valid;
}

function validateAgree() {
  const valid = elements.agree.checked;
  showError('agree', !valid);
  return valid;
}

function isFormValid() {
  return validateName() && validateEmail() && validatePassword() && validateConfirm() && validateAgree();
}

const form = document.getElementById('signupForm');
const successMsg = document.getElementById('successMsg');

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const valid =
    validateName() &&
    await validateEmail() &&
    validatePassword() &&
    validateConfirm() &&
    validateAgree();

  if (!valid) return;

  successMsg.style.display = 'block';
  form.submit();
});


elements.name?.addEventListener('input', validateName);
elements.email?.addEventListener('input', validateEmail);
elements.password?.addEventListener('input', () => { validatePassword(); validateConfirm(); });
elements.confirm?.addEventListener('input', validateConfirm);
elements.agree?.addEventListener('change', validateAgree);