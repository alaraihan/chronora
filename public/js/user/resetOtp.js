function handleInput(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    const index = parseInt(input.dataset.index);
    if (input.value.length === 1 && index < 5) {
      const next = document.querySelector(`input[name="otp"][data-index="${index + 1}"]`);
      if (next) next.focus();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('input[name="otp"]')?.focus();
  });

  document.getElementById('resendBtn').addEventListener('click', async () => {
    const btn = document.getElementById('resendBtn');
    const msg = document.getElementById('resendMsg');

    btn.disabled = true;
    btn.textContent = "Sending...";
    msg.textContent = "";

    try {
      const res = await fetch('/resendResetOtp', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        msg.style.color = "#155724";
        msg.textContent = "New OTP sent successfully!";
      } else {
        msg.style.color = "#721c24";
        msg.textContent = data.message || "Failed to send OTP";
      }
    } catch (err) {
      msg.style.color = "#721c24";
      msg.textContent = "Network error. Check console.";
      console.error(err);
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "Request new OTP";
      }, 2000);
    }
  });