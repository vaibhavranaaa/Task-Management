const express = require('express');
const {
  createCategory,
  getAllCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');
const { validate, createCategorySchema, updateCategorySchema } = require('../validators');

const router = express.Router();

router.use(protect);

router.route('/')
  .post(validate(createCategorySchema), createCategory)
  .get(getAllCategories);

router.route('/:id')
  .get(getCategory)
  .patch(validate(updateCategorySchema), updateCategory)
  .delete(deleteCategory);

module.exports = router;