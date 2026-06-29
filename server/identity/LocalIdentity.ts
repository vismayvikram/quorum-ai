import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  timezoneOffset?: number;
}

/**
 * Middleware to extract and verify the user identity from JWT session cookie.
 */
export function requireLocalIdentity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required but was not defined.');
  }

  let token = req.cookies?.session;
  
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No session token found' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }
    
    req.userId = decoded.userId;

    const tzOffset = req.headers['x-timezone-offset'];
    req.timezoneOffset = tzOffset ? Number(tzOffset) : new Date().getTimezoneOffset();

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
}
