import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import { store } from "./server/db/store";
import { requireLocalIdentity, AuthenticatedRequest } from "./server/identity/LocalIdentity";
import { timeRouter } from "./server/time/timeRoutes";
import { plannerRouter } from "./server/agents/planner/plannerRoutes";
import { settingsRouter } from "./server/settingsRoutes";
import { schedulerRouter } from "./server/scheduler/schedulerRoutes";
import { authRouter } from "./server/identity/authRoutes";
import { coachRouter } from "./server/agents/coach/coachRoutes";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Safe endpoint for retrieving Firebase config at runtime rather than build-time
  app.get('/api/firebase-config', (req, res) => {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        return res.json(JSON.parse(fileContent));
      }
    } catch (e) {
      console.error("Error reading firebase-applet-config.json:", e);
    }
    
    // Fallback to environment variables
    res.json({
      apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "",
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "",
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "",
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "",
      appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || ""
    });
  });

  // Mount API Routers
  app.use('/api', timeRouter);
  app.use('/api', plannerRouter);
  app.use('/api', settingsRouter);
  app.use('/api', schedulerRouter);
  app.use('/api', authRouter);
  app.use('/api', coachRouter);

  // Get Profile
  app.get("/api/profile", requireLocalIdentity, (req: AuthenticatedRequest, res) => {
    const profile = store.getDoc('profiles', req.userId!);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  });

  // Create/Update Profile
  app.post("/api/profile", requireLocalIdentity, (req: AuthenticatedRequest, res) => {
    const profileData = req.body;
    const profile = {
      ...profileData,
      id: req.userId,
      createdAt: Date.now()
    };
    store.setDoc('profiles', req.userId!, profile);
    
    // Also initialize default settings if not exist
    if (!store.getDoc('settings', req.userId!)) {
      store.setDoc('settings', req.userId!, {
        userId: req.userId,
        blockedWindows: [],
        durationMultiplier: 1.0,
        developerTimeControlsEnabled: false
      });
    }
    
    res.json(profile);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
