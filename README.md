<div align="center">

# 📋 Task Management API

**A secure, production-ready RESTful API for managing personal tasks.**

Built with Node.js & Express.js · PostgreSQL for users · MongoDB for tasks · JWT authentication

[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)
[![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)](https://jwt.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docker.com)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture and Design Decisions](#architecture-and-design-decisions)
- [Folder Structure](#folder-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Event-Driven Features](#event-driven-features)
- [Security](#security)
- [Postman Collection](#postman-collection)

---

## Overview

A backend API for a Task Management application allowing users to register, log in, and manage their own tasks with real-time reminder scheduling, task categorization, free-form tags, and an event-driven webhook system for external analytics integration.

Each user can only access and modify their own tasks and categories. Cross-user access returns 403 Forbidden.

The project uses a dual-database architecture: user identity data lives in PostgreSQL (relational, ACID-compliant), while task and category documents live in MongoDB (flexible, document-oriented).

---

## Features

| Feature | Details |
|---|---|
| User Registration | Unique email, bcrypt-hashed password (12 salt rounds) |
| JWT Authentication | Stateless auth, configurable expiry, Bearer token scheme |
| User Profile | Authenticated endpoint returning safe user data |
| Task CRUD | Create, read, update (partial), delete — scoped to owner |
| Task Categories | User-owned categories with name, color, and description |
| Task Tags | Free-form tags per task, comma-separated filter support |
| Reminder Scheduling | In-memory scheduler fires 1 hour before due date (configurable) |
| Completion Webhook | POST to external analytics URL when task is marked completed |
| Retry Logic | 3 attempts with exponential backoff and jitter on webhook failure |
| Ownership Enforcement | Users cannot read, modify, or delete another user's data |
| Input Validation | Joi schemas on all endpoints |
| Global Error Handling | Normalises Sequelize, Mongoose, JWT, and operational errors |
| Rate Limiting | 100 requests per 15 minutes per IP |
| Security Headers | Helmet middleware |
| Structured Logging | Winston — console and file output |
| Docker Support | Full Compose setup with health checks |
| Graceful Shutdown | Handles SIGTERM and SIGINT cleanly |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 20 LTS | JavaScript server environment |
| Framework | Express.js 4 | HTTP routing and middleware |
| SQL Database | PostgreSQL 16 | Persistent user storage |
| SQL ORM | Sequelize 6 | Schema sync, parameterised queries |
| NoSQL Database | MongoDB 7 | Task and category document storage |
| NoSQL ODM | Mongoose 8 | Schema validation, indexes, hooks |
| Authentication | jsonwebtoken | JWT signing and verification |
| Password Hashing | bcryptjs | Secure password storage |
| Validation | Joi | Declarative request body validation |
| HTTP Client | Axios | Webhook delivery with retry logic |
| Scheduling | Node.js setTimeout | In-memory reminder scheduler |
| Security | Helmet, cors, express-rate-limit | HTTP hardening |
| Logging | Winston | Levelled structured logging |
| Dev Tooling | Nodemon, dotenv | Auto-reload, environment management |
| Containers | Docker, Docker Compose | Reproducible local environment |

---

## Architecture and Design Decisions

### Task Categorization — User-Owned Dynamic Categories

Categories are created per user rather than pre-seeded globally. Each user builds their own taxonomy (Work, Personal, Urgent, etc.) without colliding with other users. A compound unique index on userId + name prevents duplicate category names per user while allowing different users to reuse the same names.

When a category is deleted, all tasks that referenced it automatically have their category field set to null — no orphaned references remain.

### Tag Management — Embedded Free-Form Strings

Tags are stored as an array of strings directly on each task document rather than in a separate collection. This keeps queries simple with no joins needed, allows MongoDBs $all operator for multi-tag filtering, and avoids unnecessary collection overhead for scalar metadata. Tags are normalised to lowercase and deduplicated before saving via Mongoose pre-save hooks.

### Reminder Scheduling — In-Memory with Rehydration

Reminders use Node.js setTimeout timers stored in a Map keyed by task ID. This avoids the operational complexity of Redis and BullMQ for a single-server deployment.

Key design choices:

**Cancellation** — Every scheduleReminder() call cancels any existing timer for that task first, making it safe to call on both create and update.

**Rehydration** — On server restart, rehydrateReminders() queries MongoDB for all pending tasks without a reminderSentAt value and reschedules their timers. This prevents reminder loss on restarts.

**Idempotency** — reminderSentAt is written to the task document when a reminder fires. The scheduler checks this field before scheduling, so a reminder can never fire twice even after a restart.

**Completion cancellation** — When a task is marked completed, its pending reminder timer is immediately cancelled.

**Test override** — REMINDER_LEAD_TIME_OVERRIDE_MS in .env allows a small value like 60000 (1 minute) for demo purposes instead of waiting a full hour.

### Webhook Retry — Exponential Backoff with Jitter

The completion webhook uses a retry loop with exponential backoff:

- Attempt 1: Immediate
- Attempt 2: ~2 seconds delay
- Attempt 3: ~4 seconds delay

Jitter of plus or minus 20 percent is added to prevent thundering-herd problems when multiple tasks complete simultaneously. After 3 failures the error is logged at ERROR level with the full payload. Webhook delivery is fire-and-forget and does not block the API response.

### Stateless JWT Authentication

No server-side session store is required. The JWT payload contains only the user ID. On every protected request the protect middleware re-fetches the user from PostgreSQL, ensuring deleted accounts are rejected immediately without any token blacklist.

### 403 Forbidden vs 404 for Ownership Violations

When a user tries to access another users task or category the API returns 403 Forbidden rather than 404 Not Found. This correctly communicates the resource exists but access is denied, which is the correct REST semantics.

---

## Folder Structure

```
task-management-api/
├── src/
│   ├── server.js                    Entry point — DB connect, rehydrate reminders, HTTP server
│   ├── app.js                       Express app — middleware, routes, 404, error handler
│   ├── config/
│   │   ├── postgres.js              Sequelize instance and sync
│   │   └── mongo.js                 Mongoose connection
│   ├── models/
│   │   ├── User.js                  Sequelize (PostgreSQL) with bcrypt hooks
│   │   ├── Task.js                  Mongoose with category ref, tags, reminder tracking
│   │   └── Category.js              Mongoose with user-owned unique name index
│   ├── controllers/
│   │   ├── authController.js        register, login, getMe
│   │   ├── taskController.js        CRUD + reminder scheduling + webhook trigger
│   │   └── categoryController.js    CRUD for categories
│   ├── middleware/
│   │   ├── auth.js                  protect() — JWT verification
│   │   └── errorHandler.js          Global error normaliser
│   ├── routes/
│   │   ├── authRoutes.js            POST /register, POST /login, GET /me
│   │   ├── taskRoutes.js            Full task CRUD with filters
│   │   └── categoryRoutes.js        Full category CRUD
│   ├── services/
│   │   ├── reminderScheduler.js     In-memory timer system with rehydration
│   │   └── webhookService.js        Axios POST with exponential backoff retry
│   ├── validators/
│   │   └── index.js                 Joi schemas for all endpoints
│   └── utils/
│       ├── AppError.js              Custom error class with statusCode
│       ├── catchAsync.js            Async handler wrapper
│       └── logger.js                Winston logger
├── logs/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
└── TaskManagementV2.postman_collection.json
```

---

## Getting Started

### Prerequisites

Docker option: Docker Desktop installed and running.

Local option: Node.js 18 or higher, PostgreSQL 14 or higher, MongoDB 6 or higher.

### Option A — Docker (Recommended)

```bash
git clone https://github.com/vaibhavranaaa/Task-Management.git
cd Task-Management
cp .env.example .env
# Edit .env and set JWT_SECRET, POSTGRES_PASSWORD, and webhook URLs
docker compose up --build
```

API available at http://localhost:3000

### Option B — Local Setup

```bash
git clone https://github.com/vaibhavranaaa/Task-Management.git
cd Task-Management
npm install
cp .env.example .env
# Edit .env with your local database credentials
```

Create the PostgreSQL database:

```bash
# macOS or Linux
psql -U postgres -c "CREATE DATABASE taskmanager_users;"

# Windows
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE taskmanager_users;"
```

MongoDB requires no manual setup. Mongoose creates collections automatically.

```bash
npm run dev    # development with auto-reload
npm start      # production
```

Verify the server is running:

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"...","reminders":{"active":0}}
```

---

## Environment Variables

Copy .env.example to .env and fill in all values.

```env
NODE_ENV=development
PORT=3000

JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRES_IN=7d

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=taskmanager_users
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

MONGODB_URI=mongodb://localhost:27017/taskmanager_tasks

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

ANALYTICS_WEBHOOK_URL=https://webhook.site/your-unique-id
NOTIFICATION_WEBHOOK_URL=https://webhook.site/your-unique-id

REMINDER_LEAD_TIME_OVERRIDE_MS=
```

| Variable | Required | Description |
|---|---|---|
| JWT_SECRET | Yes | Minimum 32-character random string |
| POSTGRES_PASSWORD | Yes | PostgreSQL password |
| MONGODB_URI | Yes | Full MongoDB connection string |
| ANALYTICS_WEBHOOK_URL | No | Fires on task completion with retry logic |
| NOTIFICATION_WEBHOOK_URL | No | Fires when a reminder triggers |
| REMINDER_LEAD_TIME_OVERRIDE_MS | No | Override lead time for testing (e.g. 60000 = 1 minute) |

---

## API Documentation

Base URL: http://localhost:3000/api/v1

All protected endpoints marked with a lock require this header:

```
Authorization: Bearer <jwt_token>
```

---

### Authentication Endpoints

#### POST /auth/register

```json
{
  "name": "Vaibhav Rana",
  "email": "vaibhav@example.com",
  "password": "Secret123"
}
```

Password rules: minimum 8 characters, one uppercase, one lowercase, one digit.

Response 201:
```json
{
  "status": "success",
  "token": "<JWT>",
  "data": { "user": { "id": "uuid", "name": "Vaibhav Rana", "email": "vaibhav@example.com" } }
}
```

---

#### POST /auth/login

Body: email and password fields.

Response 200: Same shape as register.

Error 401: Invalid email or password.

---

#### GET /auth/me (protected)

Returns the authenticated users profile. No body needed.

---

### Category Endpoints

All category endpoints require authentication. Users can only access their own categories.

#### POST /categories (protected)

```json
{
  "name": "Work",
  "color": "#6366f1",
  "description": "Work related tasks"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| name | string | Yes | 1 to 50 chars, unique per user |
| color | string | No | Hex code like #ff0000, defaults to #6366f1 |
| description | string | No | Up to 200 chars |

Response 201: Category object.

Error 409: Category name already exists for this user.

---

#### GET /categories (protected)

Returns all categories for the authenticated user sorted alphabetically.

---

#### GET /categories/:id (protected)

Returns a single category.

---

#### PATCH /categories/:id (protected)

Send any subset of name, color, or description. At least one field required.

---

#### DELETE /categories/:id (protected)

Deletes the category and sets category to null on all tasks that referenced it.

Response 204: No content.

---

### Task Endpoints

All task endpoints require authentication. Tasks belonging to another user return 403.

#### POST /tasks (protected)

```json
{
  "title": "Complete API assignment",
  "description": "Finish the task management API",
  "dueDate": "2026-12-31T10:00:00.000Z",
  "status": "pending",
  "category": "<category_mongo_id>",
  "tags": ["high-priority", "backend", "assignment"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| title | string | Yes | 1 to 200 chars |
| description | string | No | Up to 2000 chars |
| dueDate | ISO 8601 | Yes | Must be a future date |
| status | pending or completed | No | Defaults to pending |
| category | MongoDB ObjectId | No | Must belong to the same user |
| tags | array of strings | No | Up to 20 tags, normalised to lowercase |

A reminder is automatically scheduled 1 hour before the dueDate (configurable).

Response 201: Task object with populated category.

---

#### GET /tasks (protected)

Returns all tasks for the authenticated user. Supports filtering and sorting.

| Param | Values | Default |
|---|---|---|
| status | pending or completed | all tasks |
| category | MongoDB ObjectId | all |
| tags | comma-separated strings | all |
| sortBy | createdAt, dueDate, title, status | createdAt |
| order | asc or desc | desc |

Tag filter requires the task to contain ALL specified tags.

Example: GET /tasks?status=pending&category=id&tags=backend,urgent&sortBy=dueDate&order=asc

---

#### GET /tasks/:id (protected)

Returns a single task with populated category.

Error 404: Task not found.
Error 403: Task belongs to another user.

---

#### PATCH /tasks/:id (protected)

Send any subset of fields. At least one field required.

```json
{ "status": "completed" }
```

Side effects on update:
- Status changes to completed: reminder cancelled, analytics webhook fires
- dueDate changes: reminderSentAt resets, new reminder scheduled
- Status returns to pending: reminder rescheduled

---

#### DELETE /tasks/:id (protected)

Cancels any pending reminder before deletion.

Response 204: No content.

---

### Error Reference

All errors follow this shape:
```json
{ "status": "fail", "message": "Human-readable description" }
```

| Status | When |
|---|---|
| 400 | Validation failure, missing fields, malformed body |
| 401 | Missing, expired, or invalid JWT |
| 403 | Authenticated but accessing another users resource |
| 404 | Task or category not found, or unknown route |
| 409 | Email already registered, or duplicate category name |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

---

## Event-Driven Features

### Reminder Scheduling

The reminder system uses Node.js setTimeout timers managed in a Map keyed by task ID.

Lifecycle:
1. Create task — scheduleReminder() sets a timer for dueDate minus lead time
2. Update dueDate — old timer cancelled, new timer set, reminderSentAt reset to null
3. Mark completed — cancelReminder() called immediately
4. Delete task — cancelReminder() called before deletion
5. Server restart — rehydrateReminders() re-queries pending tasks and reschedules all timers

When a reminder fires it logs task details to console and file, marks reminderSentAt on the document to prevent duplicate firing, and POSTs to NOTIFICATION_WEBHOOK_URL if configured.

Demo tip: Set REMINDER_LEAD_TIME_OVERRIDE_MS=60000 and create a task with dueDate 2 minutes from now. The reminder fires after approximately 1 minute.

---

### Completion Webhook

When a task status transitions to completed the system fires a POST to ANALYTICS_WEBHOOK_URL with this payload:

```json
{
  "event": "task.completed",
  "taskId": "mongo-object-id",
  "title": "Complete API assignment",
  "userId": "postgres-uuid",
  "completedAt": "2026-04-12T10:00:00.000Z",
  "dueDate": "2026-12-31T10:00:00.000Z",
  "category": "category-id",
  "tags": ["high-priority", "backend"]
}
```

Retry schedule:

| Attempt | Delay |
|---|---|
| 1 | Immediate |
| 2 | ~2 seconds |
| 3 | ~4 seconds |

Each delay includes plus or minus 20 percent jitter. After 3 failures the full payload is logged at ERROR level. Delivery is fire-and-forget and never delays the API response.

To test: open https://webhook.site, copy your unique URL into ANALYTICS_WEBHOOK_URL, then mark any task as completed in Postman. The payload appears on webhook.site within seconds.

---

## Security

| Measure | Implementation |
|---|---|
| Password hashing | bcrypt with 12 salt rounds |
| JWT signing | HS256, secret never in responses |
| User enumeration prevention | Login returns same message regardless of whether email exists |
| HTTP security headers | Helmet middleware |
| Rate limiting | 100 requests per 15 minutes per IP |
| Request size cap | express.json limit of 10kb |
| Mass assignment prevention | Joi stripUnknown removes undeclared fields |
| SQL injection prevention | Sequelize parameterised queries |
| Secrets management | All credentials in .env, never hardcoded |
| Container security | Dockerfile runs as non-root user |
| Schema enforcement | Mongoose validators on every insert and update |

---

## Postman Collection

Import TaskManagementV2.postman_collection.json into Postman.

Set the baseUrl collection variable to http://localhost:3000. Register and Login automatically save the JWT to the token variable and the first created category ID to categoryId. All protected requests use these automatically.

Collection folders:
- Auth — Register, Login, Get Profile
- Categories — Full CRUD for categories
- Tasks — Full CRUD with category and tag filtering, reminder demo, webhook demo
- Error and Validation Demos — Pre-built requests showing all error cases
- Health — Server health check with active reminder count

---

<div align="center">
Made with Node.js, Express, PostgreSQL, and MongoDB
</div>
