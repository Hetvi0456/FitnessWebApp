# Fitness Challenge App

A full-stack fitness challenge web application built with React + Vite on the frontend and Node.js + Express on the backend, backed by MongoDB Atlas.

---

## Tech Stack

| Layer     | Technology                     |
|-----------|-------------------------------|
| Frontend  | React 18, Vite, JavaScript    |
| Backend   | Node.js, Express, JavaScript  |
| Database  | MongoDB Atlas *(configured later)* |
| Package   | npm                            |

---

## Project Structure

```
FitnessWebApp/
├── client/          # React + Vite frontend
├── server/          # Express backend
│   └── src/
│       ├── app.js       # Express app configuration
│       └── server.js    # Server entry point
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

---

### Running the Backend

```bash
cd server
npm install
npm run dev        # Development (nodemon)
# or
npm start          # Production
```

The API server starts on **http://localhost:5000**.

Health check: `GET http://localhost:5000/api/health`

---

### Running the Frontend

```bash
cd client
npm install
npm run dev
```

The React app starts on **http://localhost:5173**.

API requests prefixed with `/api` are automatically proxied to `http://localhost:5000`.

---

## Environment Variables

Create a `server/.env` file (never committed):

```env
PORT=5000
# MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/fitness
```

---

## Available Scripts

### `client/`

| Command         | Description                    |
|-----------------|-------------------------------|
| `npm run dev`   | Start Vite dev server          |
| `npm run build` | Build for production           |
| `npm run preview` | Preview production build     |

### `server/`

| Command       | Description                         |
|---------------|-------------------------------------|
| `npm run dev` | Start with nodemon (auto-reload)    |
| `npm start`   | Start with Node.js directly         |
