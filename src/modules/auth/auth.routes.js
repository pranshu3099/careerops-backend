import { Router } from "express";
import passport from "passport";
import { AuthController } from "./auth.controller.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { loginSchema, registerSchema } from "../../validators/auth.schema.js";
import authenticate from "../../middlewares/auth.middleware.js";
import rateLimit from "../../middlewares/rateLimit.middleware.js";
import { csrfProtection } from "../../middlewares/csrf.middleware.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { AUTH_MESSAGES } from "../../constants/messages.js";

const router = Router();
const getClientIp = (req) =>
  req.ip || req.headers["x-forwarded-for"] || "unknown";
const authLimiter = rateLimit(10, 60, (req) => `auth:${getClientIp(req)}`);
const refreshLimiter = rateLimit(
  30,
  60,
  (req) => `auth-refresh:${getClientIp(req)}`,
);
const oauthLimiter = rateLimit(
  20,
  60,
  (req) => `auth-google:${getClientIp(req)}`,
);

router.get("/failed", (req, res) => {
  return res.status(HTTP_STATUS.UNAUTHORIZED).json({
    success: false,
    message: AUTH_MESSAGES.AUTHENTICATION_FAILED,
  });
});

router.get(
  "/google",
  oauthLimiter,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/auth/failed",
  }),
  AuthController.googleCallback,
);

router.post(
  "/register",
  authLimiter,
  validateRequest(registerSchema),
  AuthController.register,
);

router.post(
  "/login",
  authLimiter,
  validateRequest(loginSchema),
  AuthController.login,
);
router.get("/csrf", AuthController.csrf);
router.post("/logout", csrfProtection, AuthController.logout);
router.post("/refresh", refreshLimiter, csrfProtection, AuthController.refresh);
router.get("/verify-email", AuthController.verifyEmail);
router.get("/me", authenticate, AuthController.me);
export default router;
