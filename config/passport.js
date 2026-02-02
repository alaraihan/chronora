import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/userSchema.js";
import dotenv from "dotenv";
dotenv.config();


passport.use(new GoogleStrategy({
  clientID:process.env.GOOGLE_CLIENTID,
  clientSecret:process.env.GOOGLE_CLIENTSECRET,
  callbackURL:"alaraihan.site/auth/google/callback"
},
async (accessToken,refreshToken,profile,done)=>{
  try {
    let user=await User.findOne({googleId:profile.id});
    if (user) {
      return done(null,user);
    }
    const fullName = profile.displayName || (profile.name && `${profile.name.givenName || ""} ${profile.name.familyName || ""}`).trim() || "No name";
    const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || "";

    user = await User.create({
      fullName,
      email,
      googleId: profile.id,
      isVerified: true
    });

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}
)
);
passport.serializeUser((user,done)=>{
  done(null,user.id);
});
passport.deserializeUser((id,done)=>{
  User.findById(id)
    .then(user=>{
      done(null,user);
    })
    .catch(err=>{
      done(err,null);
    });
});
export default passport;
