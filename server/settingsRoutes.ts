import { Router } from 'express';
import { requireLocalIdentity, AuthenticatedRequest } from './identity/LocalIdentity';
import { store } from './db/store';

export const settingsRouter = Router();

settingsRouter.get('/settings', requireLocalIdentity, (req: AuthenticatedRequest, res) => {
  const settings = store.getDoc('settings', req.userId!);
  res.json(settings || { 
    userId: req.userId, 
    blockedWindows: [], 
    durationMultiplier: 1.0, 
    developerTimeControlsEnabled: false 
  });
});

settingsRouter.post('/settings', requireLocalIdentity, (req: AuthenticatedRequest, res) => {
  const settings = req.body;
  settings.userId = req.userId;
  store.setDoc('settings', req.userId!, settings);
  res.json(settings);
});
