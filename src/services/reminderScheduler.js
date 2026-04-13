const axios = require('axios');
const logger = require('../utils/logger');

/**
 * ReminderScheduler — In-memory task reminder system.
 *
 * Design Decision:
 * We use a pure in-memory approach with setTimeout rather than a heavy queue
 * like BullMQ (which requires Redis). This keeps the stack simple for a demo
 * while demonstrating the event-driven pattern correctly.
 *
 * Trade-off: Timers are lost on server restart. In production you would
 * persist scheduled jobs to Redis/DB and replay them on boot. The
 * reminderSentAt field on Task guards against duplicate sends if the server
 * restarts and reschedules a task whose reminder already fired.
 *
 * How it works:
 *  1. scheduleReminder(task) — called after create/update.
 *     Cancels any existing timer for that task, calculates ms until 1h before
 *     dueDate, and sets a new setTimeout.
 *  2. cancelReminder(taskId) — called when a task is deleted or completed
 *     before the reminder fires.
 *  3. On trigger — logs to console/file AND posts to WEBHOOK_URL if configured.
 */

const REMINDER_LEAD_TIME_MS = 60 * 60 * 1000; // 1 hour before due date
// For demo/testing: set REMINDER_LEAD_TIME_OVERRIDE_MS in .env to a small value
// e.g. 60000 = fire reminder 1 minute before due date instead of 1 hour

// Map of taskId -> TimeoutHandle so we can cancel/replace timers
const timers = new Map();

/**
 * Schedule (or re-schedule) a reminder for a task.
 * Safe to call multiple times — always cancels the previous timer first.
 *
 * @param {object} task - Mongoose Task document
 */
const scheduleReminder = (task) => {
  const taskId = task._id.toString();

  // Cancel any existing timer for this task
  cancelReminder(taskId);

  // Don't schedule for completed tasks
  if (task.status === 'completed') {
    logger.debug(`[Reminder] Skipping schedule for completed task ${taskId}`);
    return;
  }

  // Don't schedule if reminder was already sent
  if (task.reminderSentAt) {
    logger.debug(`[Reminder] Reminder already sent for task ${taskId}, skipping`);
    return;
  }

  const leadTimeMs = parseInt(process.env.REMINDER_LEAD_TIME_OVERRIDE_MS, 10) || REMINDER_LEAD_TIME_MS;
  const now = Date.now();
  const fireAt = new Date(task.dueDate).getTime() - leadTimeMs;
  const delayMs = fireAt - now;

  if (delayMs <= 0) {
    logger.debug(`[Reminder] Task ${taskId} due date is too soon or in the past — no reminder scheduled`);
    return;
  }

  const minutesUntilFire = Math.round(delayMs / 60000);
  logger.info(`[Reminder] Scheduled reminder for task "${task.title}" (${taskId}) in ${minutesUntilFire} minute(s)`);

  const handle = setTimeout(() => {
    fireReminder(task);
    timers.delete(taskId);
  }, delayMs);

  // Prevent the timer from blocking Node.js process exit
  if (handle.unref) handle.unref();

  timers.set(taskId, handle);
};

/**
 * Cancel a scheduled reminder (e.g. task deleted or marked complete).
 *
 * @param {string} taskId
 */
const cancelReminder = (taskId) => {
  const id = taskId.toString();
  if (timers.has(id)) {
    clearTimeout(timers.get(id));
    timers.delete(id);
    logger.info(`[Reminder] Cancelled reminder for task ${id}`);
  }
};

/**
 * Fire the reminder — log it and optionally POST to a webhook.
 *
 * @param {object} task - Mongoose Task document (snapshot at schedule time)
 */
const fireReminder = async (task) => {
  const taskId = task._id.toString();

  logger.info(
    `\n${'='.repeat(60)}\n` +
    `🔔 REMINDER TRIGGERED\n` +
    `   Task    : "${task.title}" (${taskId})\n` +
    `   User    : ${task.userId}\n` +
    `   Due     : ${new Date(task.dueDate).toISOString()}\n` +
    `   Status  : ${task.status}\n` +
    `${'='.repeat(60)}\n`
  );

  // Update reminderSentAt in DB to prevent duplicate fires on restart
  try {
    const Task = require('../models/Task');
    await Task.findByIdAndUpdate(taskId, { reminderSentAt: new Date() });
  } catch (err) {
    logger.error(`[Reminder] Failed to mark reminderSentAt for task ${taskId}:`, err);
  }

  // Post to notification webhook if configured
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
  if (webhookUrl) {
    const payload = {
      event: 'task.reminder',
      taskId,
      title: task.title,
      dueDate: task.dueDate,
      userId: task.userId,
      triggeredAt: new Date().toISOString(),
    };
    try {
      await axios.post(webhookUrl, payload, { timeout: 5000 });
      logger.info(`[Reminder] Notification webhook delivered for task ${taskId}`);
    } catch (err) {
      logger.warn(`[Reminder] Notification webhook failed for task ${taskId}: ${err.message}`);
    }
  }
};

/**
 * On server startup, reschedule reminders for all pending tasks that
 * haven't had their reminder sent yet. Prevents reminder loss on restart.
 */
const rehydrateReminders = async () => {
  try {
    const Task = require('../models/Task');
    const now = new Date();
    const leadTimeMs = parseInt(process.env.REMINDER_LEAD_TIME_OVERRIDE_MS, 10) || REMINDER_LEAD_TIME_MS;
    const cutoff = new Date(now.getTime() + leadTimeMs);

    // Find tasks that are still pending, reminder not yet sent, due in the future
    const tasks = await Task.find({
      status: 'pending',
      reminderSentAt: null,
      dueDate: { $gt: now },
    });

    logger.info(`[Reminder] Rehydrating ${tasks.length} reminder(s) from DB`);
    tasks.forEach((task) => scheduleReminder(task));
  } catch (err) {
    logger.error('[Reminder] Failed to rehydrate reminders:', err);
  }
};

/**
 * Returns the count of active timers (for health/debug endpoints).
 */
const activeCount = () => timers.size;

module.exports = { scheduleReminder, cancelReminder, rehydrateReminders, activeCount };