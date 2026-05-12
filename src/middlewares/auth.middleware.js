import jwt from "jsonwebtoken";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { AUTH_MESSAGES } from "../constants/messages.js";

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.cookies?.access_token;

  if (!token) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      message: AUTH_MESSAGES.UNAUTHORIZED_REQUEST,
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = payload; 

    next();
  } catch (err) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      message: AUTH_MESSAGES.TOKEN_EXPIRED_OR_INVALID,
    });
  }
};

export default authenticate;
