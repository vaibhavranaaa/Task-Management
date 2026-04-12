const Joi = require('joi');

// ─── User Validators ──────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name cannot exceed 100 characters',
    'any.required': 'Name is required',
  }),
  email: Joi.string().trim().email().lowercase().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required',
    }),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email().lowercase().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

// ─── Task Validators ──────────────────────────────────────────────────────────

const createTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required().messages({
    'string.min': 'Title cannot be empty',
    'string.max': 'Title cannot exceed 200 characters',
    'any.required': 'Task title is required',
  }),
  description: Joi.string().trim().max(2000).allow('').default('').messages({
    'string.max': 'Description cannot exceed 2000 characters',
  }),
  dueDate: Joi.date().iso().greater('now').required().messages({
    'date.base': 'Due date must be a valid date',
    'date.format': 'Due date must be in ISO 8601 format (e.g., 2025-12-31)',
    'date.greater': 'Due date must be in the future',
    'any.required': 'Due date is required',
  }),
  status: Joi.string().valid('pending', 'completed').default('pending').messages({
    'any.only': 'Status must be either "pending" or "completed"',
  }),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).messages({
    'string.min': 'Title cannot be empty',
    'string.max': 'Title cannot exceed 200 characters',
  }),
  description: Joi.string().trim().max(2000).allow('').messages({
    'string.max': 'Description cannot exceed 2000 characters',
  }),
  dueDate: Joi.date().iso().messages({
    'date.base': 'Due date must be a valid date',
    'date.format': 'Due date must be in ISO 8601 format (e.g., 2025-12-31)',
  }),
  status: Joi.string().valid('pending', 'completed').messages({
    'any.only': 'Status must be either "pending" or "completed"',
  }),
})
  .min(1) // Require at least one field for partial updates
  .messages({
    'object.min': 'At least one field must be provided for update',
  });

// ─── Validator Middleware Factory ─────────────────────────────────────────────

/**
 * Returns Express middleware that validates req.body against a Joi schema.
 * On failure, responds immediately with 400 and the first validation error.
 */
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: true,    // report first error only (fast feedback)
    stripUnknown: true,  // silently remove unknown fields (security)
  });

  if (error) {
    return res.status(400).json({
      status: 'fail',
      message: error.details[0].message,
    });
  }

  req.body = value; // replace body with sanitized/coerced values
  next();
};

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  createTaskSchema,
  updateTaskSchema,
};
