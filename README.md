# Fitness Challenge App

A full-stack fitness challenge web application built with React + Vite on the frontend and Node.js + Express on the backend, backed by MongoDB Atlas.

---

## Tech Stack

| Layer     | Technology                      |
|-----------|---------------------------------|
| Frontend  | React 18, Vite, JavaScript      |
| Backend   | Node.js, Express, JavaScript    |
| Database  | MongoDB Atlas + Mongoose        |
| Package   | npm                             |

---

## Project Structure

```
FitnessWebApp/
├── client/                  # React + Vite frontend
├── server/                  # Express backend
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js        # Mongoose connection module
│   │   ├── app.js           # Express app + routes
│   │   └── server.js        # Entry point (DB → HTTP)
│   ├── .env                 # Local secrets (gitignored)
│   └── .env.example         # Template (committed)
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account

---

## MongoDB Atlas Setup

### 1. Create a Deployment

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Click **Build a Database** → choose the **Free (M0)** tier.
3. Select a cloud provider and region → click **Create**.

### 2. Create a Database User

1. In the left sidebar go to **Security → Database Access**.
2. Click **Add New Database User**.
3. Choose **Password** authentication.
4. Set a username and a strong password — **save these**.
5. Set the role to **Atlas admin** (or restrict to the specific database later).
6. Click **Add User**.

### 3. Configure Network Access

1. Go to **Security → Network Access**.
2. Click **Add IP Address**.
3. For development, click **Allow Access from Anywhere** (`0.0.0.0/0`).
4. For production, whitelist only your server's IP.
5. Click **Confirm**.

### 4. Get the Connection String

1. Go to **Deployment → Database** and click **Connect** on your cluster.
2. Choose **Drivers** → select **Node.js**.
3. Copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<username>` and `<password>` with the credentials from Step 2.
5. Add your database name before `?`:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/fitness_app?retryWrites=true&w=majority
   ```

### 5. Configure the Local Environment

Open (or create) `server/.env` and paste your connection string:

```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/fitness_app?retryWrites=true&w=majority
```

> **Never commit `server/.env`.** It is already listed in `.gitignore`.

### 6. Start the Backend

```powershell
cd server
npm run dev
```

On successful connection you will see:

```
✅ MongoDB Atlas connected successfully.
╔══════════════════════════════════════════╗
║  Fitness Challenge API                   ║
║  Server running on http://localhost:5000 ║
╚══════════════════════════════════════════╝
```

### 7. Verify the Database Connection

```powershell
Invoke-WebRequest -Uri http://localhost:5000/api/health | Select-Object -ExpandProperty Content
```

**Connected response (HTTP 200):**
```json
{
  "success": true,
  "message": "Fitness Challenge API is running!",
  "database": { "status": "connected" }
}
```

**Disconnected response (HTTP 503):**
```json
{
  "success": false,
  "message": "Fitness Challenge API is running, but the database is not connected.",
  "database": { "status": "disconnected" }
}
```

---

## Running the Frontend

```powershell
cd client
npm run dev
```

The React app starts on **http://localhost:5173**.  
API requests prefixed with `/api` are automatically proxied to `http://localhost:5000`.

---

## Environment Variables Reference

| Variable      | Required | Description                          |
|---------------|----------|--------------------------------------|
| `PORT`        | No       | HTTP port (defaults to `5000`)       |
| `MONGODB_URI` | **Yes**  | Full MongoDB Atlas connection string |

See [`server/.env.example`](./server/.env.example) for the template.

---

## Available Scripts

### `client/`

| Command             | Description                  |
|---------------------|------------------------------|
| `npm run dev`       | Start Vite dev server        |
| `npm run build`     | Build for production         |
| `npm run preview`   | Preview production build     |

### `server/`

| Command         | Description                         |
|-----------------|-------------------------------------|
| `npm run dev`   | Start with nodemon (auto-reload)    |
| `npm start`     | Start with Node.js directly         |
