import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface HostSession {
  sanctuaryId: string;
  hostToken: string;
  topic: string;
  description?: string;
  emoji?: string;
  expiresAt: string;
  submissionsCount: number;
  createdAt: string;
}

interface UseHostSessionProps {
  sanctuaryId: string;
}

export const useHostSession = ({ sanctuaryId }: UseHostSessionProps) => {
  const [hostSession, setHostSession] = useState<HostSession | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Get host token from multiple sources with priority
  const getHostToken = useCallback(() => {
    // 1. URL params (highest priority for recovery links)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('hostToken');
    
    // 2. localStorage (normal case)
    const tokenFromStorage = localStorage.getItem(`sanctuary-host-${sanctuaryId}`);
    
    // 3. sessionStorage (fallback)
    const tokenFromSession = sessionStorage.getItem(`sanctuary-host-${sanctuaryId}`);
    
    return tokenFromUrl || tokenFromStorage || tokenFromSession;
  }, [sanctuaryId]);

  // Store host token with persistence strategy
  const storeHostToken = useCallback((token: string) => {
    try {
      // Store in multiple locations for redundancy
      localStorage.setItem(`sanctuary-host-${sanctuaryId}`, token);
      sessionStorage.setItem(`sanctuary-host-${sanctuaryId}`, token);
      
      // Store in cookie for cross-tab persistence (httpOnly would be better but needs server-side)
      document.cookie = `sanctuary-host-${sanctuaryId}=${token}; path=/; max-age=${24 * 60 * 60}; SameSite=Strict`;
    } catch (error) {
      console.error('Failed to store host token:', error);
    }
  }, [sanctuaryId]);

  // Get host token from cookie as fallback
  const getTokenFromCookie = useCallback(() => {
    const name = `sanctuary-host-${sanctuaryId}=`;
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length);
      }
    }
    return null;
  }, [sanctuaryId]);

  // Verify host token with server
  const verifyHostToken = useCallback(async (token: string) => {
    try {
      const response = await fetch('/api/host-recovery/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hostToken: token }),
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        const sessionData: HostSession = {
          sanctuaryId: data.data.sanctuaryId,
          hostToken: data.data.hostToken,
          topic: data.data.topic,
          description: data.data.description,
          emoji: data.data.emoji,
          expiresAt: data.data.expiresAt,
          submissionsCount: data.data.submissionsCount,
          createdAt: data.data.createdAt
        };
        
        setHostSession(sessionData);
        storeHostToken(token);
        setError(null);
        return sessionData;
      } else {
        throw new Error(data.error || 'Invalid host token');
      }
    } catch (error: any) {
      setError(error.message);
      return null;
    }
  }, [storeHostToken]);

  // Initialize and validate host session
  useEffect(() => {
    const initializeSession = async () => {
      setIsValidating(true);
      setError(null);

      // Try to get token from various sources
      let token = getHostToken();
      
      // If no token found, try cookie fallback
      if (!token) {
        token = getTokenFromCookie();
      }

      if (!token) {
        setError('No host token found. You may not be the host of this sanctuary.');
        setIsValidating(false);
        return;
      }

      // Verify token with server
      const sessionData = await verifyHostToken(token);
      
      if (!sessionData) {
        // Token invalid, try to clear all stored tokens
        try {
          localStorage.removeItem(`sanctuary-host-${sanctuaryId}`);
          sessionStorage.removeItem(`sanctuary-host-${sanctuaryId}`);
          document.cookie = `sanctuary-host-${sanctuaryId}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        } catch (e) {
          console.error('Failed to clear invalid tokens:', e);
        }
      }

      setIsValidating(false);
    };

    if (sanctuaryId) {
      initializeSession();
    }
  }, [sanctuaryId, getHostToken, getTokenFromCookie, verifyHostToken]);

  // Generate recovery URL
  const generateRecoveryUrl = useCallback(async (email?: string) => {
    if (!hostSession) return null;

    try {
      const response = await fetch('/api/host-recovery/generate-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sanctuaryId: hostSession.sanctuaryId,
          hostToken: hostSession.hostToken,
          recoveryEmail: email
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        return data.data.recoveryUrl;
      } else {
        throw new Error(data.error || 'Failed to generate recovery URL');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Recovery Link Error',
        description: error.message,
      });
      return null;
    }
  }, [hostSession, toast]);

  // Check if session is expired
  const isExpired = useCallback(() => {
    if (!hostSession) return false;
    return new Date(hostSession.expiresAt) <= new Date();
  }, [hostSession]);

  // Get time remaining
  const getTimeRemaining = useCallback(() => {
    if (!hostSession) return 0;
    const now = new Date().getTime();
    const expires = new Date(hostSession.expiresAt).getTime();
    return Math.max(0, expires - now);
  }, [hostSession]);

  return {
    hostSession,
    isValidating,
    error,
    isHost: !!hostSession,
    isExpired: isExpired(),
    timeRemaining: getTimeRemaining(),
    generateRecoveryUrl,
    refreshSession: () => {
      if (hostSession) {
        verifyHostToken(hostSession.hostToken);
      }
    }
  };
};