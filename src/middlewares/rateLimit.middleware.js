import { slidingWindowRateLimiter } from "../utils/rateLimiter";
const rateLimit = (limit, windowSizeInSeconds, keyGenerator) => async (req, res, next) => {
    const key = keyGenerator(req);
    const isAllowed = await slidingWindowRateLimiter({
        key,
        limit,
        windowSizeInSeconds
    });
    if (!isAllowed) {
        return res.status(429).json({ error: "Too many requests" });
    }
    next();
}
export default rateLimit;






