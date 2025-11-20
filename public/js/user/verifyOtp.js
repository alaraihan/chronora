   const inputs = document.querySelectorAll('.code-inputs input');
    const form = document.getElementById('otpForm');
    const countdownEl = document.getElementById('countdown');
    const resendLink = document.getElementById('resendLink');
    const verifyBtn = document.querySelector('.verify-btn');

    let timer;
    let timeLeft = 60; 
   inputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const value = e.target.value;
        if (!/^\d$/.test(value)) {
          e.target.value = '';
          return;
        }
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          inputs[index - 1].focus();
        }
      });
    });

    function startTimer() {
      clearInterval(timer);
      timeLeft = 60;
      updateTimerDisplay();

      timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
          clearInterval(timer);
          resendLink.classList.remove('disabled');
        }
      }, 1000);
    }

    function updateTimerDisplay() {
      const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
      const secs = String(timeLeft % 60).padStart(2, '0');
      countdownEl.textContent = `${mins}:${secs}`;
    }

   
resendLink.addEventListener('click', async () => {
  if (resendLink.classList.contains('disabled')) return;

  resendLink.classList.add('disabled');
  resendLink.textContent = 'Sending...';

  try {
    const response = await fetch('/resendOtp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include' 
    });

    const result = await response.json();

    if (result.success) {
      alert('New OTP sent! Check your email.');
      startTimer(); 
      inputs.forEach(inp => inp.value = ''); 
      inputs[0].focus();
    } else {
      alert(result.message || 'Failed to resend OTP.');
    }
  } catch (err) {
    console.error('Resend failed:', err);
    alert('Network error. Please check your connection.');
  } finally {
    resendLink.textContent = 'Resend code';
    
  }
});

   
    form.addEventListener('submit', (e) => {
      const otp = Array.from(inputs)
        .map(inp => inp.value)
        .join('');

      if (otp.length !== 6) {
        e.preventDefault();
        alert('Please enter all 6 digits.');
        return;
      }

    
      let hiddenInput = document.getElementById('otpValue');
      if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'otp';
        hiddenInput.id = 'otpValue';
        form.appendChild(hiddenInput);
      }
      hiddenInput.value = otp;
    });

    
    startTimer();