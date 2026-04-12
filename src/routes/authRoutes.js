const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate, registerSchema, loginSchema } = require('../validators');

const router = express.Router();

/**
 * @route  POST /api/v1/auth/register
 * @desc   Register a new user
 * @access Public
 */
router.post('/register', validate(registerSchema), register);

/**
 * @route  POST /api/v1/auth/login
 * @desc   Log in and receive a JWT
 * @access Public
 */
router.post('/login', validate(loginSchema), login);

/**
 * @route  GET /api/v1/auth/me
 * @desc   Get authenticated user's profile
 * @access Protected
 */
router.get('/me', protect, getMe);

module.exports = router;
