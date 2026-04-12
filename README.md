# Task Management API

A secure, production-ready RESTful API for managing personal tasks. Built with **Node.js / Express.js**, storing user data in **PostgreSQL** and task data in **MongoDB**, with JWT-based authentication.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Folder Structure](#folder-structure)
4. [Design Decisions](#design-decisions)
5. [Getting Started](#getting-started)
   - [Option A — Docker (Recommended)](#option-a--docker-recommended)
   - [Option B — Local (Manual)](#option-b--local-manual)
6. [Environment Variables](#environment-variables)
7. [API Documentation](#api-documentation)
   - [Auth Endpoints](#auth-endpoints)
   - [Task Endpoints](#task-endpoints)
   - [Error Responses](#error-responses)
8. [Security Highlights](#security-highlights)

---

## Features

- **User registration** with bcrypt-hashed passwords (salt rounds: 12)
- **JWT authentication** with configurable expiry
- **Full CRUD** for tasks, scoped strictly to the owning user
- **Dual-database** architecture: PostgreSQL (users) + MongoDB (tasks)
- **Joi validation** on all inputs — bad data never reaches the database
- **Global error handler** normalises Sequelize, Mongoose, and JWT errors
- **Rate limiting** (100 req / 15 min per IP) via `express-rate-limit`
- **Helmet** security headers
- **Docker Compose** for zero-friction local setup
- **Graceful shutdown** on SIGTERM / SIGINT
- **Winston** structured logging to console + rotating files

---

## Tech Stack

| Layer          | Technology                         |
|----------------|------------------------------------|
| Runtime        | Node.js 20 LTS                     |
| Framework      | Express.js 4                       |
| Auth           | jsonwebtoken + bcryptjs             |
| SQL DB         | PostgreSQL 16 via Sequelize ORM    |
| NoSQL DB       | MongoDB 7 via Mongoose ODM         |
| Validation     | Joi                                |
| Logging        | Winston                            |
| Security       | Helmet, express-rate-limit, CORS   |
| Dev tooling    | Nodemon, dotenv                    |
| Containers     | Docker, Docker Compose             |

---

## Folder Structure

```
task-management-api/
├── src/
│   ├── app.js               # Express app (middleware, routes, 404, error handler)
│   ├── server.js            # Entry point — DB connections + HTTP server
│   ├── config/
│   │   ├── postgres.js      # Sequelize instance & connectPostgres()
│   │   └── mongo.js         # Mongoose connectMongo()
│   ├── controllers/
│   │   ├── authController.js   # register, login, getMe
│   │   └── taskController.js   # createTask, getAllTasks, getTask, updateTask, deleteTask
│   ├── middleware/
│   │   ├── auth.js          # protect() — JWT verification & user attachment
│   │   └── errorHandler.js  # Global error handler
│   ├── models/
│   │   ├── User.js          # Sequelize model (PostgreSQL)
│   │   └── Task.js          # Mongoose model (MongoDB)
│   ├── routes/
│   │   ├── authRoutes.js    # /api/v1/auth/*
│   │   └── taskRoutes.js    # /api/v1/tasks/*
│   ├── validators/
│   │   └── index.js         # Joi schemas + validate() middleware factory
│   └── utils/
│       ├── AppError.js      # Custom operational error class
│       ├── catchAsync.js    # Async error wrapper for route handlers
│       └── logger.js        # Winston logger
├── logs/                    # Auto-created at runtime
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
└── TaskManagement.postman_collection.json
```

---

## Design Decisions

### Why PostgreSQL for users and MongoDB for tasks?

Users are relational entities with a unique-email constraint — perfect for SQL with Sequelize enforcing uniqueness at the DB level. Tasks are document-like (variable description length, future extensibility for tags/attachments) and accessed purely by owner — a great fit for MongoDB. The two are linked via the user's PostgreSQL UUID stored as a plain string field (`userId`) in every Mongo task document.

### JWT stored client-side (stateless auth)

No server-side session store is needed. The JWT contains only the user ID. On every protected request, `protect` middleware re-fetches the user from Postgres — this ensures deleted accounts are immediately rejected even if their token hasn't expired.

### AppError + catchAsync pattern

All async controllers are wrapped in `catchAsync` to eliminate boilerplate try/catch blocks. Thrown `AppError` instances carry an HTTP status code and are rendered cleanly by the global error handler. Unexpected errors (programmer mistakes) bubble up as 500s with the stack trace hidden in production.

### Joi validation with `stripUnknown: true`

Unknown body fields are silently removed before they reach controllers. This prevents mass-assignment attacks and keeps the data layer clean without requiring manual field whitelisting.

### Ownership check returns 403, not 404

When a user requests another user's task, the API returns `403 Forbidden` rather than `404 Not Found`. This is intentional — it clearly communicates "this resource exists but you can't access it," which is correct REST semantics and useful for debugging without leaking private data.

---

## Getting Started

### Prerequisites

- Docker + Docker Compose **or** Node.js ≥ 18, PostgreSQL 16, MongoDB 7

### Option A — Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/your-username/task-management-api.git
cd task-management-api

# 2. Create your .env from the example
cp .env.example .env
# Edit .env — at minimum change JWT_SECRET and POSTGRES_PASSWORD

# 3. Start everything
docker compose up --build

# The API is now available at http://localhost:3000
```

Docker Compose starts three services:
- `postgres` — PostgreSQL 16 (port 5432)
- `mongo` — MongoDB 7 (port 27017)
- `api` — Node.js app (port 3000)

The API waits for both databases to be healthy before accepting connections.

### Option B — Local (Manual)

```bash
# 1. Clone and install
git clone https://github.com/your-username/task-management-api.git
cd task-management-api
npm install

# 2. Create your .env
cp .env.example .env
# Fill in your local Postgres and Mongo credentials

# 3. Create the Postgres database
psql -U postgres -c "CREATE DATABASE taskmanager_users;"

# MongoDB requires no manual setup — Mongoose creates collections automatically.

# 4. Start in development mode (auto-reload)
npm run dev

# Or in production mode
npm start
```

### Verify the server is running

```bash
curl http://localhost:3000/health
# → {"status":"ok","timestamp":"2025-..."}
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values.

| Variable                  | Default                  | Description                              |
|---------------------------|--------------------------|------------------------------------------|
| `NODE_ENV`                | `development`            | `development` or `production`            |
| `PORT`                    | `3000`                   | HTTP listen port                         |
| `JWT_SECRET`              | *(required)*             | Min 32-char random string                |
| `JWT_EXPIRES_IN`          | `7d`                     | JWT lifetime (ms string or seconds)      |
| `POSTGRES_HOST`           | `localhost`              | PostgreSQL host                          |
| `POSTGRES_PORT`           | `5432`                   | PostgreSQL port                          |
| `POSTGRES_DB`             | `taskmanager_users`      | Database name                            |
| `POSTGRES_USER`           | `postgres`               | Database user                            |
| `POSTGRES_PASSWORD`       | *(required)*             | Database password                        |
| `MONGODB_URI`             | `mongodb://localhost:27017/taskmanager_tasks` | Full MongoDB connection string |
| `RATE_LIMIT_WINDOW_MS`    | `900000` (15 min)        | Rate-limit window in milliseconds        |
| `RATE_LIMIT_MAX_REQUESTS` | `100`                    | Max requests per window per IP           |

---

## API Documentation

**Base URL:** `http://localhost:3000/api/v1`

All protected endpoints require:
```
Authorization: Bearer <JWT>
```

---

### Auth Endpoints

#### `POST /auth/register`

Create a new account.

**Request body:**
```json
{
  "name": "Alice Smith",
  "email": "alice@example.com",
  "password": "Secret123"
}
```

Password rules: ≥ 8 chars, at least one uppercase, one lowercase, one digit.

**Response `201`:**
```json
{
  "status": "success",
  "token": "<JWT>",
  "data": {
    "user": {
      "id": "uuid-v4",
      "name": "Alice Smith",
      "email": "alice@example.com",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

#### `POST /auth/login`

Authenticate and receive a JWT.

**Request body:**
```json
{
  "email": "alice@example.com",
  "password": "Secret123"
}
```

**Response `200`:** Same shape as register.

**Response `401`** (wrong credentials):
```json
{
  "status": "fail",
  "message": "Invalid email or password."
}
```

---

#### `GET /auth/me` 🔒

Returns the authenticated user's profile.

**Response `200`:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid-v4",
      "name": "Alice Smith",
      "email": "alice@example.com",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

### Task Endpoints

All task endpoints are protected. Tasks belonging to another user return `403`.

---

#### `POST /tasks` 🔒

Create a new task.

**Request body:**
```json
{
  "title": "Finish API documentation",
  "description": "Write README and Postman collection",
  "dueDate": "2026-12-31T00:00:00.000Z",
  "status": "pending"
}
```

`description` and `status` are optional. `dueDate` must be a future ISO 8601 date.

**Response `201`:**
```json
{
  "status": "success",
  "data": {
    "task": {
      "_id": "mongo-object-id",
      "title": "Finish API documentation",
      "description": "Write README and Postman collection",
      "dueDate": "2026-12-31T00:00:00.000Z",
      "status": "pending",
      "userId": "uuid-v4",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

---

#### `GET /tasks` 🔒

Return all tasks for the authenticated user.

**Query parameters (all optional):**

| Param    | Values                        | Default      |
|----------|-------------------------------|--------------|
| `status` | `pending` \| `completed`      | (all)        |
| `sortBy` | `createdAt` \| `dueDate` \| `title` | `createdAt` |
| `order`  | `asc` \| `desc`               | `desc`       |

Example: `GET /tasks?status=pending&sortBy=dueDate&order=asc`

**Response `200`:**
```json
{
  "status": "success",
  "results": 2,
  "data": {
    "tasks": [ /* array of task objects */ ]
  }
}
```

---

#### `GET /tasks/:id` 🔒

Get a single task by its MongoDB ObjectId.

**Response `200`:** Single task object.
**Response `404`:** Task not found.
**Response `403`:** Task belongs to another user.

---

#### `PATCH /tasks/:id` 🔒

Partially update a task. Only send the fields you want to change.

**Request body (any subset):**
```json
{
  "status": "completed"
}
```

**Response `200`:** Updated task object.

---

#### `DELETE /tasks/:id` 🔒

Delete a task.

**Response `204`:** No body.
**Response `403`:** Task belongs to another user.

---

### Error Responses

All errors follow this shape:

```json
{
  "status": "fail",
  "message": "Human-readable error message"
}
```

| Status | Meaning                                              |
|--------|------------------------------------------------------|
| `400`  | Bad Request — validation failure or malformed data   |
| `401`  | Unauthorized — missing, expired, or invalid JWT      |
| `403`  | Forbidden — authenticated but not the resource owner |
| `404`  | Not Found — resource or route doesn't exist          |
| `409`  | Conflict — email already registered                  |
| `429`  | Too Many Requests — rate limit exceeded              |
| `500`  | Internal Server Error — unexpected server error      |

---

## Security Highlights

- Passwords hashed with **bcrypt** (12 salt rounds) — never stored in plaintext
- **JWT** signed with HS256; secret never exposed in responses
- **Generic auth error messages** prevent user enumeration (login always says "Invalid email or password")
- **Helmet** sets 14 HTTP security headers (XSS protection, HSTS, etc.)
- **Rate limiting** blocks brute-force attempts
- **Request body size limit** (10 KB) prevents large payload attacks
- **`stripUnknown: true`** in Joi removes unexpected fields before they reach the DB
- All sensitive config loaded from **environment variables** — never hardcoded
- Docker container runs as a **non-root user**
- Sequelize uses **parameterised queries** — SQL injection not possible
- Mongoose **schema validation** enforces types at the ODM layer

---

## Postman Collection

Import `TaskManagement.postman_collection.json` into Postman.

Set the `baseUrl` collection variable to `http://localhost:3000`. The **Register** and **Login** requests include a test script that automatically saves the returned JWT to the `token` collection variable — all protected requests will use it immediately.
