const express = require('express');
const {
  createTask,
  getAllTasks,
  getTask,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');
const { protect } = require('../middleware/auth');
const { validate, createTaskSchema, updateTaskSchema } = require('../validators');

const router = express.Router();

// All task routes require authentication
router.use(protect);

/**
 * @route  POST   /api/v1/tasks
 * @route  GET    /api/v1/tasks
 * @access Protected
 */
router.route('/').post(validate(createTaskSchema), createTask).get(getAllTasks);

/**
 * @route  GET    /api/v1/tasks/:id
 * @route  PATCH  /api/v1/tasks/:id
 * @route  DELETE /api/v1/tasks/:id
 * @access Protected (owner only)
 */
router
  .route('/:id')
  .get(getTask)
  .patch(validate(updateTaskSchema), updateTask)
  .delete(deleteTask);

module.exports = router;
