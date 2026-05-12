import jwt from "jsonwebtoken";
import crypto from "crypto"
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";

export const generateToken = (payload) => {
return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
})
}

export const generateRefreshToken = () =>{
    return crypto.randomBytes(64).toString("hex");
};

export const hashToken = (token) =>{
    return crypto.createHash("sha256").update(token).digest("hex")
}
