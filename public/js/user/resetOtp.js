(function() {
  'use strict';
  
  console.log('Script loaded');
  
  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  function init() {
    console.log('Initializing timer');
    
    const timerSpan = document.getElementById('timer');
    const timerDisplay = document.getElementById('timerDisplay');
    const resendBtn = document.getElementById('resendBtn');
    const resendMsg = document.getElementById('resendMsg');
    
    if (!timerSpan) {
      console.error('Timer span not found!');
      return;
    }
    
    const TIMER_KEY = 'otp_reset_timer';
    let interval;
    
    // Get or create timer end time
    function getEndTime() {
      const saved = sessionStorage.getItem(TIMER_KEY);
      if (saved) {
        const endTime = parseInt(saved);
        console.log('Found saved timer, end time:', new Date(endTime));
        return endTime;
      }
      // Create new timer - 60 seconds from now
      const endTime = Date.now() + (60 * 1000);
      sessionStorage.setItem(TIMER_KEY, endTime.toString());
      console.log('Created new timer, end time:', new Date(endTime));
      return endTime;
    }
    
    let endTime = getEndTime();
    
    function updateDisplay() {
      const now = Date.now();
      const remaining = Math.floor((endTime - now) / 1000);
      
      console.log('Update - remaining seconds:', remaining);
      
      if (remaining <= 0) {
        clearInterval(interval);
        timerDisplay.innerHTML = '<span style="color: #f44336;">OTP expired</span>';
        resendBtn.disabled = false;
        resendBtn.style.color = '#4CAF50';
        sessionStorage.removeItem(TIMER_KEY);
        console.log('Timer expired');
        return;
      }
      
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      
      const currentSpan = document.getElementById('timer');
      if (currentSpan) {
        currentSpan.textContent = display;
      }
    }
    
    // Start timer
    updateDisplay();
    interval = setInterval(updateDisplay, 1000);
    console.log('Timer started');
    
    // Handle OTP input
    window.handleInput = function(input) {
      input.value = input.value.replace(/[^0-9]/g, '');
      const index = parseInt(input.dataset.index);
      if (input.value.length === 1 && index < 5) {
        const next = document.querySelector(`input[name="otp"][data-index="${index + 1}"]`);
        if (next) next.focus();
      }
    };
    
    // Focus first input
    const firstInput = document.querySelector('input[name="otp"]');
    if (firstInput) firstInput.focus();
    
    // Resend button
    resendBtn.addEventListener('click', async function() {
      const now = Date.now();
      const remaining = Math.floor((endTime - now) / 1000);
      
      if (this.disabled && remaining > 0) return;
      
      this.disabled = true;
      this.textContent = 'Sending...';
      this.style.color = '#999';
      resendMsg.textContent = '';
      
      try {
        const response = await fetch('/resendResetOtp', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
          resendMsg.style.color = '#155724';
          resendMsg.textContent = 'New OTP sent!';
          
          // Reset timer
          clearInterval(interval);
          endTime = Date.now() + (60 * 1000);
          sessionStorage.setItem(TIMER_KEY, endTime.toString());
          
          timerDisplay.innerHTML = 'Time remaining: <span id="timer" style="font-weight: 600; color: #4CAF50;">01:00</span>';
          updateDisplay();
          interval = setInterval(updateDisplay, 1000);
          
          setTimeout(() => resendMsg.textContent = '', 3000);
        } else {
          resendMsg.style.color = '#721c24';
          resendMsg.textContent = data.message || 'Failed to send OTP';
          this.disabled = false;
          this.textContent = 'Request new OTP';
          this.style.color = '#4CAF50';
        }
      } catch (err) {
        console.error(err);
        resendMsg.style.color = '#721c24';
        resendMsg.textContent = 'Network error';
        this.disabled = false;
        this.textContent = 'Request new OTP';
        this.style.color = '#4CAF50';
      }
    });
  }
})();