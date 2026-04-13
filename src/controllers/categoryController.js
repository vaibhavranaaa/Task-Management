const Category = require('../models/Category');
const Task = require('../models/Task');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const findCategoryForUser = async (categoryId, userId) => {
  const category = await Category.findById(categoryId);
  if (!category) throw new AppError('Category not found.', 404);
  if (category.userId !== userId) throw new AppError('You do not have permission to access this category.', 403);
  return category;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/categories
 * Create a new category for the authenticated user.
 */
const createCategory = catchAsync(async (req, res) => {
  const { name, color, description } = req.body;

  const category = await Category.create({
    name,
    color,
    description,
    userId: req.user.id,
  });

  res.status(201).json({ status: 'success', data: { category } });
});

/**
 * GET /api/v1/categories
 * Return all categories belonging to the authenticated user.
 */
const getAllCategories = catchAsync(async (req, res) => {
  const categories = await Category.find({ userId: req.user.id }).sort({ name: 1 });

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: { categories },
  });
});

/**
 * GET /api/v1/categories/:id
 * Return a single category by ID.
 */
const getCategory = catchAsync(async (req, res) => {
  const category = await findCategoryForUser(req.params.id, req.user.id);
  res.status(200).json({ status: 'success', data: { category } });
});

/**
 * PATCH /api/v1/categories/:id
 * Update a category (name, color, description).
 */
const updateCategory = catchAsync(async (req, res) => {
  await findCategoryForUser(req.params.id, req.user.id); // ownership check

  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  res.status(200).json({ status: 'success', data: { category } });
});

/**
 * DELETE /api/v1/categories/:id
 * Delete a category and null-out the category field on all tasks that used it.
 */
const deleteCategory = catchAsync(async (req, res) => {
  await findCategoryForUser(req.params.id, req.user.id); // ownership check

  // Disassociate tasks from this category before deleting
  await Task.updateMany(
    { category: req.params.id, userId: req.user.id },
    { $set: { category: null } }
  );

  await Category.findByIdAndDelete(req.params.id);

  res.status(204).json({ status: 'success', data: null });
});

module.exports = { createCategory, getAllCategories, getCategory, updateCategory, deleteCategory };