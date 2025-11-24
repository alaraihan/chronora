// utils/response.js
import { setFlash } from "./flash.js";

const sendResponse = (req, res, type, message, data = {}, redirectTo = null) => {
  const isAjax = req.xhr || req.get("Content-Type")?.includes("json") || req.headers.accept?.includes("json");

  if (isAjax) {
    return res.json({
      success: type === "success",
      message,
      ...data,
      redirect: redirectTo,
    });
  }

  setFlash(req, type, message);
  return res.redirect(redirectTo || req.headers.referer || "/admin");
};

export default sendResponse;