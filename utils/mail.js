// utils/mail.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

/**
 * sendOtp(email, otp)
 * - Development: prints OTP to console (NO Gmail login attempt)
 * - Production: sends real email via Gmail or SMTP
 */
export async function sendOtp(email, otp) {
  // -----------------------------
  // DEV MODE — No SMTP Calls
  // -----------------------------
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[DEV MODE] OTP for ${email}: ${otp}\n`);
    return true; // pretend mail sent successfully
  }

  // -----------------------------
  // PRODUCTION MODE — Real Email
  // -----------------------------
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD, // must be Gmail App Password
      },
    });

    // optional — detects bad credentials early
    await transporter.verify();

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify Your Email",
      html: `
        <p>Your OTP is <b>${otp}</b></p>
        <p>This OTP expires in 1 minute.</p>
      `,
    });

    return info.accepted && info.accepted.length > 0;
  } catch (error) {
    console.error("\n[MAIL ERROR]", error.message, "\n");
    return false;
  }
}

export function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}
