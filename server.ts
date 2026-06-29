import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
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
