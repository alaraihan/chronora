import User from '../models/userSchema.js'; 

export const generateReferralCode = async () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  while (true) {
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const existingUser = await User.findOne({ referralCode: code });

    if (!existingUser) {
      return code;
    }
  }
};