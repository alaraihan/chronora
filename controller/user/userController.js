import User from "../../models/userSchema.js";
import  {sendOtp, generateOtp } from "../../utils/mail.js";
import bcrypt from "bcrypt";

const pageNotfound = async (req, res) => {
  try {
    return res.render("user/pageNotfound", { title: "Chronora-404page" });
  } catch (error) {
    console.log("page not found");
    res.status(404).send();
  }
};

const googleCallback=(req,res)=>{
  console.log("Google login succesful,User: ",req.user);
  req.session.userId=req.user._id;
  req.session.user={
    id:req.user._id,
    fullName:req.user.fullName,
    email:req.user.email,
  }
  res.redirect("/home");
}
const loadAboutpage = async (req, res) => {
  try {
    return res.render("user/about", { title: "Chronora-About" });
  } catch (error) {
    console.log("about page is not found");
    res.status(404).send(error);
  }
};

const loadContactpage = async (req, res) => {
  try {
    return res.render("user/contact", { title: "Chronora-Contact" });
  } catch (error) {
    console.log("contact page is not found");
    res.status(404).send(error);
  }
};

const loadLandingpage = async (req, res) => {
  try {
    return res.render("user/landing", { title: "Chronora-Landing" });
  } catch (error) {
    console.log("landing page is not found");
    res.status(500).send("server error");
  }
};

const loadHomepage = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.render("user/home", { title: "Chronora — Home" });
    }
    res.render("user/home", { user: req.session.user, title: "Chronora Home" });
  } catch (error) {
    console.log("home page not found");
    res.status(500).send("server error");
  }
};

const loadProfile=async(req,res)=>{
  try{
    if(!req.session.userId){
      return res.redirect("/login");
    }
  return res.render("user/profile",{title:'User-Profile',user: req.session.user});
  }catch(error){
console.log("profile page is not found");
res.status(500).render("user/pageNotfound", {
      title: "Error - Chronora",
      message: "Something went wrong. Please try again later."
    });
  }
}


export default {
  googleCallback,
  pageNotfound,
  loadAboutpage,
  loadContactpage,
  loadLandingpage,
  loadHomepage,
  loadProfile,
  
};