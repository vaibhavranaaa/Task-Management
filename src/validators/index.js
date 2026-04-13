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
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
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
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null).optional().messages({
    'string.pattern.base': 'Category must be a valid MongoDB ObjectId',
  }),
  tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(20).default([]).messages({
    'array.max': 'A task cannot have more than 20 tags',
  }),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200),
  description: Joi.string().trim().max(2000).allow(''),
  dueDate: Joi.date().iso().messages({
    'date.base': 'Due date must be a valid date',
    'date.format': 'Due date must be in ISO 8601 format',
  }),
  status: Joi.string().valid('pending', 'completed'),
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null).optional(),
  tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(20),
})
  .min(1)
  .messages({ 'object.min': 'At least one field must be provided for update' });

// ─── Category Validators ──────────────────────────────────────────────────────

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(50).required().messages({
    'any.required': 'Category name is required',
    'string.max': 'Category name cannot exceed 50 characters',
  }),
  color: Joi.string().trim().pattern(/^#[0-9A-Fa-f]{6}$/).optional().messages({
    'string.pattern.base': 'Color must be a valid hex code (e.g. #ff0000)',
  }),
  description: Joi.string().trim().max(200).allow('').optional(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(50),
  color: Joi.string().trim().pattern(/^#[0-9A-Fa-f]{6}$/).messages({
    'string.pattern.base': 'Color must be a valid hex code (e.g. #ff0000)',
  }),
  description: Joi.string().trim().max(200).allow(''),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

// ─── Validator Middleware Factory ─────────────────────────────────────────────

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: true,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      status: 'fail',
      message: error.details[0].message,
    });
  }

  req.body = value;
  next();
};

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  createTaskSchema,
  updateTaskSchema,
  createCategorySchema,
  updateCategorySchema,
};