import { HTTP_STATUS } from "../constants/httpStatus.js";
import { COMMON_MESSAGES } from "../constants/messages.js";
const validateRequest = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    console.log(error);
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: COMMON_MESSAGES.VALIDATION_FAILED,
      errors: error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    });
  }
};

export default validateRequest;
