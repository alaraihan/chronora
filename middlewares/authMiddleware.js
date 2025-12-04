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
 console.log("isAdmin Error:", error);
    res.redirect("/admin/login");
  }
}

export const checkBlockedUser = async (req, res, next) => {
  const publicPaths = ["/login", "/register", "/logout", "/css", "/js", "/images", "/favicon.ico","/admin"];
  const isPublicPath = publicPaths.some(path => req.path.startsWith(path));
  
  if (isPublicPath) {
    return next(); 
  }
  if (!req.session || !req.session.user) {
    return next(); 
  }

  try {
    const sessionUser = req.session.user;
    let userId;
    
    if (typeof sessionUser === "string") {
      userId = sessionUser;
    } else if (sessionUser._id) {
      userId = sessionUser._id; 
    } else if (sessionUser.id) {
      userId = sessionUser.id; 
    } else if (sessionUser.userId) {
      userId = sessionUser.userId; 
    }

    if (!userId) {
      return next();
    }

    const user = await User.findById(userId).select("isBlocked");
    
    if (!user) {
      req.session.destroy();
      return res.status(404).render("user/pageNotfound", { 
        user: null, 
        title: "Not found" 
      });
    }

    if (user.isBlocked === true) {
      req.session.destroy(); 
      return res.status(404).render("user/pageNotfound", { 
        user: null, 
        title: "Not found" 
      });
    }
    next();
    
  } catch (error) {
    console.error("Error checking blocked user:", error);
    next(); 
  }
};