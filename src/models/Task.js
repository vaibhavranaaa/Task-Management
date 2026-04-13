const mongoose = require('mongoose');
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'completed'],
        message: 'Status must be either "pending" or "completed"',
      },
      default: 'pending',
    },
    // New in v2
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: 'A task cannot have more than 20 tags',
      },
    },
    // Tracks when the approaching-due reminder was sent (null = not yet sent)
    reminderSentAt: {
      type: Date,
      default: null,
    },
    // Tracks when the completion webhook was successfully delivered
    webhookSentAt: {
      type: Date,
      default: null,
    },
    // Stores the PostgreSQL user UUID
    userId: {
      type: String,
      required: [true, 'userId is required'],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Normalise tags to lowercase before saving
taskSchema.pre('save', function (next) {
  if (this.isModified('tags')) {
    this.tags = [...new Set(this.tags.map((t) => t.toLowerCase().trim()))];
  }
  next();
});

taskSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.$set && update.$set.tags) {
    update.$set.tags = [...new Set(update.$set.tags.map((t) => t.toLowerCase().trim()))];
  }
  next();
});

// Compound indexes for common query patterns
taskSchema.index({ userId: 1, createdAt: -1 });
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, category: 1 });
taskSchema.index({ userId: 1, tags: 1 });
taskSchema.index({ status: 1, dueDate: 1, reminderSentAt: 1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;