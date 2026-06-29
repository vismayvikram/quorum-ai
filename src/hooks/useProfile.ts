import { useState, useEffect, useCallback } from 'react';
import { Profile } from '../types';
import { apiFetch } from '../lib/api';

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/profile', {
        headers: {
          'x-timezone-offset': new Date().getTimezoneOffset().toString()
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setNeedsLogin(false);
        setError(null);
      } else if (res.status === 401) {
        setNeedsLogin(true);
        setProfile(null);
      } else if (res.status === 404) {
        setProfile(null);
        setNeedsLogin(false);
      } else {
        setError('Failed to fetch profile');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const saveProfile = async (profileData: Partial<Profile>) => {
    const res = await apiFetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-timezone-offset': new Date().getTimezoneOffset().toString()
      },
      body: JSON.stringify(profileData)
    });
    
    if (res.ok) {
      const data = await res.json();
      setProfile(data);
      setNeedsLogin(false);
      return data;
    } else if (res.status === 401) {
      setNeedsLogin(true);
      throw new Error('Unauthorized');
    }
    throw new Error('Failed to save profile');
  };

  const logout = async () => {
    try {
      const res = await apiFetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        localStorage.removeItem('session_token');
        setProfile(null);
        setNeedsLogin(true);
      }
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  return { 
    profile, 
    loading, 
    error, 
    saveProfile, 
    needsLogin, 
    setNeedsLogin, 
    refreshProfile: fetchProfile,
    logout 
  };
}
