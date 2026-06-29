import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { store } from '../db/store';
import { MigrationService } from './MigrationService';
import { v4 as uuidv4 } from 'uuid';

export const authRouter = Router();

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but was not defined.');
  }
  return secret;
};

const getCookieOptions = (req: any) => {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || req.hostname !== 'localhost';
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' as const : 'lax' as const,
  };
};

// Get current session
authRouter.get('/auth/me', (req, res) => {
  try {
    const secret = getJwtSecret();
    let token = req.cookies?.session;

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.json({ authenticated: false });
    }

    const decoded = jwt.verify(token, secret) as { userId: string };
    const user = store.getDoc('users', decoded.userId);
    if (!user) {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    res.json({ authenticated: false });
  }
});

// Register user
authRouter.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const secret = getJwtSecret();

    // Check if user already exists
    const existingUser = store.query('users', u => u.email.toLowerCase() === email.toLowerCase())[0];
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password securely
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userId = `auth-${uuidv4()}`;
    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      createdAt: Date.now()
    };

    store.setDoc('users', userId, newUser);

    // Create the matching profile doc (same onboarding shape)
    const profile = {
      id: userId,
      goals: '',
      context: '',
      tone: 'neutral',
      focusHours: [{ start: '09:00', end: '17:00' }],
      createdAt: Date.now()
    };
    store.setDoc('profiles', userId, profile);

    // Initialize default settings
    store.setDoc('settings', userId, {
      userId,
      blockedWindows: [],
      durationMultiplier: 1.0,
      developerTimeControlsEnabled: false
    });

    // Create signed JWT
    const token = jwt.sign({ userId }, secret, { expiresIn: '30d' });

    // Set cookie
    res.cookie('session', token, {
      ...getCookieOptions(req),
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      success: true,
      token,
      user: { id: userId, email: newUser.email }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error during registration' });
  }
});

// Login user
authRouter.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const secret = getJwtSecret();

    const user = store.query('users', u => u.email.toLowerCase() === email.toLowerCase())[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create signed JWT
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '30d' });

    // Set cookie
    res.cookie('session', token, {
      ...getCookieOptions(req),
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error during login' });
  }
});

// Logout user
authRouter.post('/auth/logout', (req, res) => {
  res.clearCookie('session', getCookieOptions(req));
  res.json({ success: true });
});

// Explicit Migration Endpoint
authRouter.post('/auth/migrate', (req, res) => {
  const { localId, authId, forceMerge } = req.body;

  if (!localId || !authId) {
    return res.status(400).json({ error: 'Missing localId or authId' });
  }

  const result = MigrationService.migrate(localId, authId, !!forceMerge);

  res.json(result);
});
