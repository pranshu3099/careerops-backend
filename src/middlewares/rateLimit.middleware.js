import { slidingWindowRateLimiter } from "../utils/rateLimiter.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { COMMON_MESSAGES } from "../constants/messages.js";

const rateLimit =
  (limit, windowSizeInSeconds, keyGenerator) => async (req, res, next) => {
    const key = keyGenerator(req);
    const isAllowed = await slidingWindowRateLimiter({
      key,
      limit,
      windowSizeInSeconds,
    });

    if (!isAllowed) {
      return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        error: COMMON_MESSAGES.TOO_MANY_REQUESTS,
      });
    }

    next();
  };

export default rateLimit;
