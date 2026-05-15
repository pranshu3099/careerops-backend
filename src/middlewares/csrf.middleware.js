import crypto from "crypto";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { COMMON_MESSAGES } from "../constants/messages.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_BYTES = 32;
const CSRF_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const csrfCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: CSRF_TOKEN_MAX_AGE_MS,
};

const parseAllowedOrigins = () =>
  [
    process.env.FRONTEND_URL,
    process.env.BACKEND_URL,
    process.env.CSRF_ALLOWED_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((origin) => origin.trim())
    .filter(Boolean);

const timingSafeEqual = (a, b) => {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) return false;

  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

export const createCsrfToken = () =>
  crypto.randomBytes(CSRF_TOKEN_BYTES).toString("hex");

export const setCsrfCookie = (res, token) => {
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions);
};

export const clearCsrfCookie = (res) => {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: csrfCookieOptions.httpOnly,
    secure: csrfCookieOptions.secure,
    sameSite: csrfCookieOptions.sameSite,
  });
};

export const originCheck = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (!origin) return next();

  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.includes(origin)) return next();

  return res.status(HTTP_STATUS.FORBIDDEN).json({
    success: false,
    message: COMMON_MESSAGES.ORIGIN_NOT_ALLOWED,
  });
};

export const csrfProtection = (req, res, next) => {
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: COMMON_MESSAGES.CSRF_TOKEN_REQUIRED,
    });
  }

  if (!timingSafeEqual(cookieToken, headerToken)) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: COMMON_MESSAGES.INVALID_CSRF_TOKEN,
    });
  }

  return next();
};



// timingSafeEqual compares two tokens in a safer way.

// Normally, string comparison may stop as soon as it finds a difference.

// Example:

// "abcdef" === "xbcdef"
// This fails immediately at the first character.

// But:

// "abcdef" === "abcdeg"
// This compares almost the whole string before failing.

// That tiny time difference can theoretically help an attacker guess a secret token character by character.

// crypto.timingSafeEqual(a, b) avoids that by comparing both values in a way that takes a consistent amount of time, so attackers cannot learn useful information from timing differences.

// In our CSRF code:

// timingSafeEqual(cookieToken, headerToken)
// means:

// Compare the CSRF token from the cookie with the CSRF token from the request header without leaking timing clues.

// We also check length first:

// if (aBuffer.length !== bBuffer.length) return false;
// because crypto.timingSafeEqual throws an error if the two buffers are different lengths.