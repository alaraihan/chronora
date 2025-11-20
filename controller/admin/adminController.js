import Admin from "../../models/adminSchema.js";
import User from "../../models/userSchema.js";
import bcrypt from "bcrypt";
import Category from "../../models/categorySchema.js";
const loadLogin = (req, res) => {
  if (req.session.admin) return res.redirect("/admin/dashboard");

  res.render("admin/adminLogin", {
    message: null,
    title: "Admin Login - Chronora",
    layout: "layouts/adminLayouts/auth",
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email:req.body.email});

    if (!admin) {
      return res.render("admin/adminLogin", {
        message: "Invalid email or password",
        layout: "layouts/adminLayouts/auth",
      });
    }

    const match = true;

    if (!match && !(await bcrypt.compare(password, admin.password))) {
      return res.render("admin/adminLogin", {
        message: "Invalid email or password",
        layout: "layouts/adminLayouts/auth",
      });
    }

    req.session.admin = {
      id: admin._id.toString(),
      email: admin.email,
      name: admin.fullName || "Admin",
    };
    req.session.save(err=>{
      if(err) console.log("session save error: ",err);
      return res.redirect("/admin/dashboard");
    })
  } catch (err) {
    console.error(err);
    res.render("admin/adminLogin", {
      message: "Server error",
      layout: "layouts/adminLayouts/auth",
    });
  }
};

const dashboard = (req, res) => {
  if (!req.session.admin) return res.redirect("/admin/login");

  res.render("admin/dashboard", {
    admin: req.session.admin,
    title: "Dashboard - Chronora Admin",
    layout: "layouts/adminLayouts/main",
    page: "dashboard",
  });
};

const loadlogout=(req,res)=>{
  try{
    if(!req.session.admin){
    return res.redirect("/admin/login");
    }
 res.render("admin/logout",{title: "Error - Chronora",layout:'layouts/adminLayouts/auth'})
  }catch(error){
 console.log("logout page is not found");
    res.status(500).render("admin/logout",{ title: "Error - Chronora",
      message: "Something went wrong. Please try again later.",
})
  }
}

const logout = (req, res) => {
  req.session.destroy((err)=>{
    if(err){
      console.log("session destroy error: ",err);
      return res.status(500).render("admin/error",{
        title:"Logout Failed",message:"Couldnt logout.pls try again later"
      })
    }
  });

  res.clearCookie("connect.sid");
  res.redirect("/admin/login");
};

const loadCustomers = async (req, res) => {
  try {
    const search=req.query.search||"";
    const page = Number(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * 3;
    let filter={};
   if(search){
    filter={
        $or: [
          { fullName: { $regex: new RegExp(search, "i") } },
          { email: { $regex: new RegExp(search, "i") } }
        ]
      };
    }
    const totalCustomers = await User.countDocuments(filter);
    const customers = await User.find(filter).skip(skip).limit(limit).lean();
    res.render("admin/customers", {
      title: "Customers",
      page: "customers",
      customers,
            search,
      currentPage: page,
      totalPages: Math.ceil(totalCustomers / limit),
      totalCustomers,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("server error");
  }
};

const toggleBlockCustomer = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.json({ success: false, message: "user not found" });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();
    return res.json({ success: true, isBlocked: user.isBlocked });
  } catch (error) {
    console.error(err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};


export default {
  loadLogin,
  login,
  dashboard,
  loadlogout,
  logout,
  loadCustomers,
  toggleBlockCustomer,
 
};
