import jwt from "jsonwebtoken";
import crypto from "crypto"
export const generateToken = (payload) => {
return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn:"7d"
})
}

export const generateRefreshToken = () =>{
    return crypto.randomBytes(64).toString("hex");
};

export const hashToken = (token) =>{
    return crypto.createHash("sha256").update(token).digest("hex")
}