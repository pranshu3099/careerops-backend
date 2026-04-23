import { Router } from "express";
import passport from "passport";
import { AuthController } from "./auth.controller.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { loginSchema, registerSchema } from "../../validators/auth.schema.js";

const router = Router();

router.get("/failed", (req, res) => {
  return res.status(401).json({
    success: false,
    message: "Authentication failed",
  });
});

router.get(
  "/google",
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
  validateRequest(registerSchema),
  AuthController.register,
);

router.post("/login", validateRequest(loginSchema), AuthController.login);
router.post("/logout", AuthController.logout);
router.post("/auth/refresh", AuthController.refresh);
router.get("/verify-email", AuthController.verifyEmail);
router.get("/me", AuthController.me);
export default router;
