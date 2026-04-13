const Task = require('../models/Task');
const Category = require('../models/Category');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { scheduleReminder, cancelReminder } = require('../services/reminderScheduler');
const { notifyTaskCompleted } = require('../services/webhookService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const findTaskForUser = async (taskId, userId) => {
  const task = await Task.findById(taskId).populate('category');
  if (!task) throw new AppError('Task not found.', 404);
  if (task.userId !== userId) throw new AppError('You do not have permission to access this task.', 403);
  return task;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/tasks
 */
const createTask = catchAsync(async (req, res) => {
  const { title, description, dueDate, status, category, tags } = req.body;

  // Validate category belongs to user if provided
  if (category) {
    const cat = await Category.findById(category);
    if (!cat) throw new AppError('Category not found.', 404);
    if (cat.userId !== req.user.id) throw new AppError('You do not own this category.', 403);
  }

  const task = await Task.create({
    title,
    description,
    dueDate,
    status: status || 'pending',
    category: category || null,
    tags: tags || [],
    userId: req.user.id,
  });

  const populated = await task.populate('category');

  // Schedule 1-hour-before reminder
  scheduleReminder(populated);

  res.status(201).json({ status: 'success', data: { task: populated } });
});

/**
 * GET /api/v1/tasks
 * Supports filters: status, category, tags (comma-separated), sortBy, order
 */
const getAllTasks = catchAsync(async (req, res) => {
  const { status, category, tags, sortBy = 'createdAt', order = 'desc' } = req.query;

  const filter = { userId: req.user.id };

  if (status && ['pending', 'completed'].includes(status)) {
    filter.status = status;
  }

  if (category) {
    filter.category = category; // MongoDB ObjectId string comparison
  }

  if (tags) {
    // Support comma-separated tags: ?tags=bug,urgent
    const tagList = tags.split(',').map((t) => t.toLowerCase().trim()).filter(Boolean);
    if (tagList.length > 0) {
      filter.tags = { $all: tagList }; // task must have ALL specified tags
    }
  }

  const sortOrder = order === 'asc' ? 1 : -1;
  const allowedSortFields = ['createdAt', 'dueDate', 'title', 'status'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const tasks = await Task.find(filter)
    .populate('category')
    .sort({ [sortField]: sortOrder });

  res.status(200).json({
    status: 'success',
    results: tasks.length,
    data: { tasks },
  });
});

/**
 * GET /api/v1/tasks/:id
 */
const getTask = catchAsync(async (req, res) => {
  const task = await findTaskForUser(req.params.id, req.user.id);
  res.status(200).json({ status: 'success', data: { task } });
});

/**
 * PATCH /api/v1/tasks/:id
 */
const updateTask = catchAsync(async (req, res) => {
  const existingTask = await findTaskForUser(req.params.id, req.user.id);
  const wasCompleted = existingTask.status === 'completed';

  // Validate new category ownership if being changed
  if (req.body.category) {
    const cat = await Category.findById(req.body.category);
    if (!cat) throw new AppError('Category not found.', 404);
    if (cat.userId !== req.user.id) throw new AppError('You do not own this category.', 403);
  }

  // If dueDate is changing, reset reminderSentAt so a new reminder can fire
  if (req.body.dueDate && req.body.dueDate !== existingTask.dueDate?.toISOString()) {
    req.body.reminderSentAt = null;
  }

  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).populate('category');

  // Handle status change to completed
  const nowCompleted = task.status === 'completed';
  if (nowCompleted && !wasCompleted) {
    // Cancel any pending reminder since the task is done
    cancelReminder(task._id.toString());
    // Fire the analytics webhook
    notifyTaskCompleted(task);
  }

  // If status went back to pending or dueDate changed, reschedule reminder
  if (!nowCompleted && (req.body.dueDate || (!wasCompleted && req.body.status === 'pending'))) {
    scheduleReminder(task);
  }

  res.status(200).json({ status: 'success', data: { task } });
});

/**
 * DELETE /api/v1/tasks/:id
 */
const deleteTask = catchAsync(async (req, res) => {
  const task = await findTaskForUser(req.params.id, req.user.id);

  // Cancel any pending reminder before deleting
  cancelReminder(task._id.toString());

  await Task.findByIdAndDelete(req.params.id);

  res.status(204).json({ status: 'success', data: null });
});

module.exports = { createTask, getAllTasks, getTask, updateTask, deleteTask };