const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      minlength: [1, 'Category name cannot be empty'],
      maxlength: [50, 'Category name cannot exceed 50 characters'],
    },
    color: {
      type: String,
      trim: true,
      default: '#6366f1', // indigo default
      match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code (e.g. #ff0000)'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      default: '',
    },
    userId: {
      type: String,
      required: [true, 'userId is required'],
      index: true,
    },
  },
  { timestamps: true }
);

// Unique category name per user (different users can have same name)
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;