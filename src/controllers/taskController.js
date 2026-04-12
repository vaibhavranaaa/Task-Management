const Task = require('../models/Task');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Finds a task by ID and verifies it belongs to the authenticated user.
 * Throws appropriate AppErrors for not-found and forbidden cases.
 *
 * @param {string} taskId - MongoDB ObjectId string
 * @param {string} userId - PostgreSQL UUID of the authenticated user
 * @returns {Promise<Task>}
 */
const findTaskForUser = async (taskId, userId) => {
  const task = await Task.findById(taskId);

  if (!task) {
    throw new AppError('Task not found.', 404);
  }

  // Ownership check: 403 (not 404) so the requester knows the resource exists
  // but they're forbidden — aligns with REST security best practices.
  if (task.userId !== userId) {
    throw new AppError('You do not have permission to access this task.', 403);
  }

  return task;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/tasks
 * Creates a new task for the authenticated user.
 */
const createTask = catchAsync(async (req, res) => {
  const { title, description, dueDate, status } = req.body;

  const task = await Task.create({
    title,
    description,
    dueDate,
    status,
    userId: req.user.id,
  });

  res.status(201).json({
    status: 'success',
    data: { task },
  });
});

/**
 * GET /api/v1/tasks
 * Returns all tasks belonging to the authenticated user.
 * Supports optional query filters: status, sortBy (createdAt|dueDate), order (asc|desc).
 */
const getAllTasks = catchAsync(async (req, res) => {
  const { status, sortBy = 'createdAt', order = 'desc' } = req.query;

  const filter = { userId: req.user.id };
  if (status && ['pending', 'completed'].includes(status)) {
    filter.status = status;
  }

  const sortOrder = order === 'asc' ? 1 : -1;
  const allowedSortFields = ['createdAt', 'dueDate', 'title'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const tasks = await Task.find(filter).sort({ [sortField]: sortOrder });

  res.status(200).json({
    status: 'success',
    results: tasks.length,
    data: { tasks },
  });
});

/**
 * GET /api/v1/tasks/:id
 * Returns a single task by ID, scoped to the authenticated user.
 */
const getTask = catchAsync(async (req, res, next) => {
  const task = await findTaskForUser(req.params.id, req.user.id);

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

/**
 * PATCH /api/v1/tasks/:id
 * Partially updates a task. Only fields provided in the body are changed.
 */
const updateTask = catchAsync(async (req, res, next) => {
  await findTaskForUser(req.params.id, req.user.id); // ownership check

  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    {
      new: true,           // return updated document
      runValidators: true, // enforce schema validators on update
    }
  );

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

/**
 * DELETE /api/v1/tasks/:id
 * Deletes a task. Returns 204 No Content on success.
 */
const deleteTask = catchAsync(async (req, res, next) => {
  await findTaskForUser(req.params.id, req.user.id); // ownership check

  await Task.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

module.exports = { createTask, getAllTasks, getTask, updateTask, deleteTask };
