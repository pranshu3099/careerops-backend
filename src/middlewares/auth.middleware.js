import jwt from "jsonwebtoken";
import { HTTP_STATUS } from "../constants/httpStatus.js";

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.cookies?.access_token;

  if (!token) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      message: "Unauthorized",
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = payload; 

    next();
  } catch (err) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      message: "Token expired or invalid",
    });
  }
};

export default authenticate;
