
const emailOtps = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [email, data] of emailOtps.entries()) {
    if (now > data.expiresAt) {
      emailOtps.delete(email);
    }
  }
}, 60_000);

export default emailOtps;