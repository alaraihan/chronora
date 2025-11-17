// Password Toggle (Show/Hide) - Works on any field with data-for attribute
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.for;           // e.g., "password" or "confirm"
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

// Get all form elements
const elements = {
  name: document.getElementById('name'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  confirm: document.getElementById('confirm'),
  agree: document.getElementById('agree')
};

// Error message divs (create them in HTML with these IDs)
const errorDivs = {
  name: document.getElementById('nameError'),
  email: document.getElementById('emailError'),
  password: document.getElementById('passwordError'),
  confirm: document.getElementById('confirmError'),
  agree: document.getElementById('agreeError')
};

// Show or hide error
function showError(field, show) {
  if (errorDivs[field]) {
    errorDivs[field].style.display = show ? 'block' : 'none';
  }
}

// Validation Functions
function validateName() {
  const valid = elements.name.value.trim().length >= 2;
  showError('name', !valid);
  return valid;
}

function validateEmail() {
  const valid = elements.email.checkValidity() && elements.email.value.includes('@');
  showError('email', !valid);
  return valid;
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

// Check if entire form is valid
function isFormValid() {
  return validateName() && validateEmail() && validatePassword() && validateConfirm() && validateAgree();
}

// Form Submit
const form = document.getElementById('signupForm');
const successMsg = document.getElementById('successMsg');

form.addEventListener('submit', function (e) {
  if (!isFormValid()) {
    e.preventDefault(); // Stop submission
  } else {
    successMsg.style.display = 'block';
    // Remove this line if you want real submit: e.preventDefault();
  }
});

// Optional: Real-time validation (nice UX)
elements.name?.addEventListener('input', validateName);
elements.email?.addEventListener('input', validateEmail);
elements.password?.addEventListener('input', () => { validatePassword(); validateConfirm(); });
elements.confirm?.addEventListener('input', validateConfirm);
elements.agree?.addEventListener('change', validateAgree);