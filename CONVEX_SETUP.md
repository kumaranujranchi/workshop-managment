# Convex Deployment & Setup Guide

This guide explains how to connect and deploy your **Workshop Management System** to **Convex** for real-time reactive updates.

## 🛠️ Prerequisites
Make sure you have [Node.js](https://nodejs.org) installed. Convex has already been added to the project dependencies.

---

## 1. Local Development Setup (Linking to Convex)

To start developing against a Convex backend locally:

1. Open your terminal in the project root directory: `e:\Agentic AI-Enabled Workshop Management System`
2. Run the Convex development CLI:
   ```bash
   npx convex dev
   ```
3. **Log in**: The command will prompt you to authenticate via your web browser (using GitHub or email).
4. **Create Project**: It will automatically ask you to create or select a Convex project name (e.g., `workshop-management-system`).
5. **Auto-Configuration**: 
   Once configured, the Convex CLI will:
   - Synchronize your schemas and functions located in the `convex/` folder to the cloud.
   - Automatically compile types and overwrite the compilation stubs inside the `convex/_generated/` folder.
   - Automatically generate a `.env.local` file containing:
     ```env
     CONVEX_DEPLOYMENT=dev-...
     NEXT_PUBLIC_CONVEX_URL=https://...
     ```
6. **Start Dev Server**: 
   Start the Next.js development server:
   ```bash
   npm run dev
   ```
   The application detects the `NEXT_PUBLIC_CONVEX_URL` environment variable and automatically switches to **Convex Mode**. You will see a glowing **"Convex Active"** badge on the dashboard.

---

## 2. Production Deployment (Netlify & Convex Cloud)

To host your project live on **Netlify** with a production Convex instance:

### A. Deploy Convex backend to Production
Run the production deploy command from your terminal:
```bash
npx convex deploy
```
This deploys the production-ready schemas and mutations from `convex/` to your Convex production deployment and prints out your production **Convex HTTP/WS URL**.

### B. Configure Environment Variables on Netlify
In your Netlify site dashboard, navigate to **Site Settings > Environment Variables** and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_CONVEX_URL` | `https://your-production-url.convex.cloud` | Your Convex production instance URL |
| `CONVEX_DEPLOYMENT` | `prod-xxxxx` | Your Convex production deployment key |

Once the environment variables are saved, trigger a new deployment on Netlify. Next.js will compile the production bundle utilizing the Convex client and api configurations.

---

## 3. Seed Database
When Convex is initialized, it starts with an empty database. 
- In our Next.js API, the system is designed to **automatically seed default facilitators** (Amit Sharma, Priya Patel, Dr. Rajesh Kumar) the first time the facilitators Registry list is requested.
- Alternatively, you can run the seed mutation manually from your CLI:
  ```bash
  npx convex run facilitators:seed
  ```

---

## 4. Dual-Mode Architecture (Fallback mechanism)
If you need to test the app offline or run integration tests without hitting your Convex backend:
- Simply remove or comment out `NEXT_PUBLIC_CONVEX_URL` from `.env.local`.
- The application will fall back to using the local **SQLite (`workshop.db`)** database automatically.
