document.querySelectorAll('.toggle-password').forEach(icon => {
  icon.addEventListener('click', () => {
    const targetId = icon.getAttribute('data-target');
    const input = document.getElementById(targetId);

    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.replace('fa-eye-slash', 'fa-eye');
    } else {
      input.type = 'password';
      icon.classList.replace('fa-eye', 'fa-eye-slash');
    }
  });
});

const toast = (msg, type = 'error') => {
  Toastify({
    text: msg,
    duration: 4000,
    gravity: "top",
    position: "right",
    backgroundColor: type === 'success' ? '#28a745' : '#dc3545',
    stopOnFocus: true,
  }).showToast();
};

document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value.trim();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  const btn = document.querySelector('.btn-save');
  const btnText = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return toast('All fields are required!');
  }
  if (newPassword !== confirmPassword) {
    return toast('New passwords do not match!');
  }
  if (newPassword.length < 8) {
    return toast('New password must be at least 8 characters!');
  }

  btn.disabled = true;
  btnText.classList.add('hidden');
  loader.classList.remove('hidden');

  try {
    const res = await axios.post('/profile/change-password', {
      currentPassword,
      newPassword
    });

    if (res.data.success) {
      toast('Password changed successfully!', 'success');
      setTimeout(() => { window.location.href = '/profile'; }, 1500);
    }
  } catch (err) {
    const message = err.response?.data?.message || 'Something went wrong!';
    toast(message);
  } finally {
    btn.disabled = false;
    btnText.classList.remove('hidden');
    loader.classList.add('hidden');
  }
});