import jwt from "jsonwebtoken";
import { HTTP_STATUS } from "../constants/httpStatus.js";

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      message: "Unauthorized",
    });
  }

  const token = authHeader.split(" ")[1];

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