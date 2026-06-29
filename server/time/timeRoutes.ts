import { Router } from 'express';
import { VirtualClock } from './VirtualClock';

export const timeRouter = Router();

timeRouter.get('/time/offset', (req, res) => {
  res.json({ 
    offsetMs: VirtualClock.getOffset(),
    virtualTime: VirtualClock.getVirtualTime(),
    realTime: Date.now()
  });
});

timeRouter.post('/time/offset', (req, res) => {
  const { offsetMs } = req.body;
  if (typeof offsetMs === 'number') {
    VirtualClock.setOffset(offsetMs);
    res.json({ success: true, offsetMs, virtualTime: VirtualClock.getVirtualTime() });
  } else {
    res.status(400).json({ error: 'Invalid offset' });
  }
});
