const emailForm = document.getElementById("email-form");
const otpForm = document.getElementById("otp-form");
const timerDiv = document.getElementById("otp-timer");
const timerSpan = document.getElementById("timer");
const resendBtn = document.getElementById("resendOtpBtn");
const newEmailInput = document.getElementById("newEmail");
const otpInput = document.getElementById("otp");

let newEmailGlobal = "";
let countdownInterval;
const OTP_SECONDS = 300; 

function showToast(message, success = true) {
  Toastify({
    text: message,
    duration: 3000,
    gravity: "top",
    position: "right",
    backgroundColor: success ? "#2ecc71" : "#e74c3c",
  }).showToast();
}

function startOtpTimer(seconds = OTP_SECONDS) {
  timerDiv.style.display = "block";
  resendBtn.style.display = "none";
  let timeLeft = seconds;
  timerSpan.textContent = timeLeft;

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    timeLeft--;
    timerSpan.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      resendBtn.style.display = "inline-block";
      timerDiv.style.display = "none";
    }
  }, 1000);
}

async function restorePending() {
  try {
    const res = await axios.get("/profile/pending-email");
    if (res.data && res.data.success && res.data.remainingSeconds > 0) {
      newEmailGlobal = res.data.pendingEmail;
      newEmailInput.value = newEmailGlobal;
      emailForm.style.display = "none";
      otpForm.style.display = "block";
      startOtpTimer(res.data.remainingSeconds);
    }
  } catch (err) {
  }
}
restorePending();

emailForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newEmail = newEmailInput.value.trim();
  if (!newEmail || !/\S+@\S+\.\S+/.test(newEmail)) {
    return showToast("Please enter a valid email!", false);
  }

  try {
    const res = await axios.post("/profile/send-email-otp", { email: newEmail }, {
      headers: { "Content-Type": "application/json" },
    });

    if (res.data && res.data.success) {
      showToast(res.data.message || "OTP sent", true);
      newEmailGlobal = newEmail.toLowerCase();
      emailForm.style.display = "none";
      otpForm.style.display = "block";
      if (res.data.expiresAt) {
        const seconds = Math.ceil((res.data.expiresAt - Date.now()) / 1000);
        startOtpTimer(Math.max(1, seconds));
      } else {
        startOtpTimer();
      }
    } else {
      showToast((res.data && res.data.message) || "Failed to send OTP", false);
    }
  } catch (err) {
    const msg = err?.response?.data?.message || "Something went wrong!!";
    showToast(msg, false);
  }
});

otpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const otp = otpInput.value.trim();

  if (!newEmailGlobal) {
    return showToast("No email pending verification. Request OTP first.", false);
  }
  if (!otp) return showToast("Please enter the OTP.", false);

  try {
    const res = await axios.post("/profile/verify-email-otp", { email: newEmailGlobal, otp }, {
      headers: { "Content-Type": "application/json" },
    });

    if (res.data && res.data.success) {
      showToast(res.data.message || "Email updated!", true);
      setTimeout(() => (window.location.href = "/profile"), 1200);
    } else {
      showToast((res.data && res.data.message) || "Verification failed", false);
    }
  } catch (err) {
    const msg = err?.response?.data?.message || "Something went wrong!";
    showToast(msg, false);
  }
});

resendBtn.addEventListener("click", async () => {
  if (!newEmailGlobal) {
    return showToast("No email to resend OTP to. Enter email first.", false);
  }

  try {
    const res = await axios.post("/profile/send-email-otp", { email: newEmailGlobal }, {
      headers: { "Content-Type": "application/json" },
    });

    if (res.data && res.data.success) {
      showToast("OTP resent successfully!", true);
      if (res.data.expiresAt) {
        const seconds = Math.ceil((res.data.expiresAt - Date.now()) / 1000);
        startOtpTimer(Math.max(1, seconds));
      } else {
        startOtpTimer();
      }
    } else {
      showToast((res.data && res.data.message) || "Failed to resend OTP", false);
    }
  } catch (err) {
    const msg = err?.response?.data?.message || "Failed to resend OTP";
    showToast(msg, false);
  }
});
