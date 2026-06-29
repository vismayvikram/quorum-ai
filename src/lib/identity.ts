import { v4 as uuidv4 } from 'uuid';

export const IDENTITY_KEY = 'lmls_user_id';

/**
 * Gets the current local UUID or generates a new one.
 */
export function getLocalIdentity(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(IDENTITY_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(IDENTITY_KEY, id);
  }
  return id;
}

export function clearLocalIdentity(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(IDENTITY_KEY);
}
