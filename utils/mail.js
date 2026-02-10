import nodemailer from "nodemailer";
import dotenv from "dotenv";
import crypto from "crypto";
import logger from "../helpers/logger.js";
dotenv.config();

const transporter =
  process.env.NODE_ENV === "production"
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.NODEMAILER_EMAIL,
          pass: process.env.NODEMAILER_PASSWORD 
        }
      })
    : null;

export async function sendOtp(email, otp) {
  if (process.env.NODE_ENV !== "production") {
    logger.info(`\n[DEV MODE] OTP for ${email}: ${otp}\n`);
    return true;
  }

 
    try {
  logger.info("Sending OTP to:", email);


    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify Your Email",
      html: `
        <p>Your OTP is <b>${otp}</b></p>
        <p>This OTP expires in 1 minute.</p>
      `
    });

    return info.accepted?.length > 0;
  } catch (error) {
    logger.error("[MAIL ERROR]", error.message);
    return false;
  }
}

export function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return crypto.randomInt(min, max).toString();
}
