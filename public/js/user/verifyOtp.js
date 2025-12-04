
const inputs = Array.from(document.querySelectorAll('.code-inputs input'));
const form = document.getElementById('otpForm');
const countdownEl = document.getElementById('countdown');
const resendLink = document.getElementById('resendLink');

let timer = null;
let timeLeft = (typeof window.INITIAL_OTP_TIME === 'number')
  ? Math.max(0, Math.floor(window.INITIAL_OTP_TIME))
  : 60;


function updateTimerDisplay() {
  const mins = Math.floor(Math.max(0, timeLeft) / 60);
  const secs = Math.floor(Math.max(0, timeLeft) % 60);
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  countdownEl.textContent = `${mm}:${ss}`;
}


function showExpiredUI() {
  updateTimerDisplay();
  countdownEl.style.color = "red";

  const parent = countdownEl.parentElement;
  if (parent) {
    const old = parent.querySelector('.otp-status');
    if (old) old.remove();

    const span = document.createElement('span');
    span.className = 'otp-status';
    span.style.marginLeft = '8px';
    span.textContent = 'Code expired';
    parent.appendChild(span);
  }

  resendLink.classList.remove('disabled');
}

function startTimer() {
  if (timer) return;
  if (timeLeft <= 0) {
    showExpiredUI();
    return;
  }

  resendLink.classList.add('disabled');
  updateTimerDisplay();

  timer = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      clearInterval(timer);
      timer = null;
      showExpiredUI();
    }
  }, 1000);
}


inputs.forEach(input => {
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('maxlength', '1');
});

inputs.forEach((input, index) => {
  input.addEventListener('input', (e) => {
    const val = e.target.value;

    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').split('');
      let i = index;
      digits.forEach(d => {
        if (i < inputs.length) {
          inputs[i].value = d;
          i++;
        }
      });
      const next = inputs.find(iEl => !iEl.value) || inputs[Math.min(inputs.length - 1, i)];
      next.focus();
      return;
    }

    if (!/^\d$/.test(val)) {
      e.target.value = '';
      return;
    }

    if (index < inputs.length - 1) {
      inputs[index + 1].focus();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      if (!input.value && index > 0) {
        inputs[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputs[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < inputs.length - 1) {
      inputs[index + 1].focus();
    } else if (e.key === 'Enter') {
      const otp = inputs.map(i => i.value).join('');
      if (otp.length === inputs.length) {
        form.requestSubmit();
      }
    }
  });
});


resendLink.addEventListener('click', async (e) => {
  e.preventDefault();
  if (resendLink.classList.contains('disabled')) return;

  resendLink.classList.add('disabled');
  const previousText = resendLink.textContent;
  resendLink.textContent = 'Sending...';

  try {
    const res = await fetch('/resendOtp', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json().catch(() => ({}));

    if (data && data.success) {
      inputs.forEach(i => i.value = '');
      if (inputs[0]) inputs[0].focus();

      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      timeLeft = (typeof data.timeLeft === 'number') ? Math.max(0, Math.floor(data.timeLeft)) : 60;
      updateTimerDisplay();
      startTimer();

    } else {
      alert(data && data.message ? data.message : 'Failed to resend');
      resendLink.classList.remove('disabled');
    }
  } catch (err) {
    console.error('Network error while resending OTP', err);
    alert('Network error. Try again.');
    resendLink.classList.remove('disabled');
  } finally {
    resendLink.textContent = previousText || 'Resend code';
  }
});


form.addEventListener('submit', (e) => {
  // Prevent submit if otp expired
  if (timeLeft <= 0) {
    e.preventDefault();
    alert('OTP expired. Please click resend to get a new code.');
    return;
  }

  const otp = inputs.map(i => i.value).join('');
  if (otp.length !== inputs.length) {
    e.preventDefault();
    alert(`Enter all ${inputs.length} digits`);
    return;
  }

  let hidden = document.getElementById('otpHidden') || document.createElement('input');
  hidden.type = 'hidden';
  hidden.name = 'otp';
  hidden.id = 'otpHidden';
  hidden.value = otp;
  form.appendChild(hidden);
});

if (timeLeft <= 0) {
  showExpiredUI();
} else {
  updateTimerDisplay();
  startTimer();
}

const firstEmpty = inputs.find(i => !i.value);
if (firstEmpty) firstEmpty.focus();
else if (inputs[0]) inputs[0].focus();
