import { Router } from 'express';
import { requireLocalIdentity, AuthenticatedRequest } from '../../identity/LocalIdentity';
import { DecompositionEngine } from './DecompositionEngine';
import { store } from '../../db/store';

export const plannerRouter = Router();

plannerRouter.post('/planner/decompose', requireLocalIdentity, async (req: AuthenticatedRequest, res) => {
  const { description, deadlineMinutes } = req.body;
  const profile = store.getDoc('profiles', req.userId!);
  const settings = store.getDoc('settings', req.userId!);

  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const result = await DecompositionEngine.decompose(
    description,
    deadlineMinutes || 0,
    profile,
    settings?.durationMultiplier || 1.0
  );

  res.json(result);
});
