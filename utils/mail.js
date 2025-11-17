import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export async function sendOtp(email,otp){
    try{
        const transporter=nodemailer.createTransport({
            host:"smtp.gmail.com",
            port:587,
            secure:false,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
            },
            tls:{
                rejectUnauthorized:false,
            }
        });

        const info=await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"verify your account",
            text:`your OTP is ${otp}.it expires in 3 minutes`,
            html:`<p>your OTP is<b>${otp}</b>.it expires in 3 minutes.</p>`,
        });
        return info.accepted && info.accepted.length>0;
    }catch(error){
        console.log("error sending email ",err);
      return false;
    }
}
export function generateOtp(length=6){
    const min=10**(length-1);
    const max=10**length-1;
    return String(Math.floor(min+Math.random()*(max-min+1)));
}
