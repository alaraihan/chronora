import User from "../models/userSchema.js";
import Admin from "../models/adminSchema.js";

export const setUser = (req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
};

function getId(val){
  if(!val) return null;

  if(typeof val==="string") return val;
  if(typeof val==="object"){
    if(val.id)return val.id.toString();
    if(val._id) return val._id.toString();
  }
  return null;
}

export const isUser=async(req,res,next)=>{
  try{
   const userId=getId(req.session.userId||req.session.user);

   if(!userId) return res.redirect("/login");
 const user=await User.findById(userId);
 
 if(!user){
  req.session.userId=null;
  return res.redirect("/login");
 }
 if(user.isBlocked){
  res.session.userId=null;
  return res.redirect("/login")
 }
   req.user=user;
   res.locals.currentUser=user;
   next();
  }catch(error){
console.log('isUser error',error);
res.redirect('/login');
  }
};

export const isAdmin=async(req,res,next)=>{
  try{
  const adminId=getId(req.session.admin||req.session.adminId);
     if(!adminId){
      return res.redirect("/admin/login");
     }
     const admin=await Admin.findById(adminId);
     if(!admin){
      req.session.admin=null;
      return res.redirect('/admin/login');
     }
     req.admin=admin;
     res.locals.currentAdmin=admin;
     next()
  }catch(error){
 console.log("isAdmin Error:", err);
    res.redirect("/admin/login");
  }
}
