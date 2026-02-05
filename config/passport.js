import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/userSchema.js";
import dotenv from "dotenv";
import { generateReferralCode } from "../helpers/referralHelper.js";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENTID,
      clientSecret: process.env.GOOGLE_CLIENTSECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || null;
        const fullName =
          profile.displayName ||
          `${profile.name?.givenName || ""} ${profile.name?.familyName || ""}`.trim() ||
          "No Name";

        let user = await User.findOne({
          $or: [{ googleId: profile.id }, { email }]
        });

        if (user && !user.googleId) {
          user.googleId = profile.id;
          user.isVerified = true;
          await user.save();
          return done(null, user);
        }

       if (!user) {
  user = await User.create({
    fullName,
    email,
    googleId: profile.id,
    referralCode: (await generateReferralCode()) ||
  Math.random().toString(36).substring(2,8).toUpperCase(),

    isVerified: true
  });
}

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
