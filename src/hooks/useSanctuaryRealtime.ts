import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';

interface SanctuarySubmission {
  id: string;
  alias: string;
  message: string;
  timestamp: string;
}

interface UseSanctuaryRealtimeProps {
  sanctuaryId: string;
  hostToken?: string;
  onNewSubmission?: (submission: SanctuarySubmission) => void;
  onConnectionChange?: (connected: boolean) => void;
  enableNotifications?: boolean;
}

interface ConnectionQuality {
  status: 'excellent' | 'good' | 'poor' | 'disconnected';
  latency: number;
  lastPing: number;
}

export const useSanctuaryRealtime = ({
  sanctuaryId,
  hostToken,
  onNewSubmission,
  onConnectionChange,
  enableNotifications = true
}: UseSanctuaryRealtimeProps) => {
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({
    status: 'disconnected',
    latency: 0,
    lastPing: Date.now()
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const [totalSubmissions, setTotalSubmissions] = useState(0);

  // Initialize notification sound
  useEffect(() => {
    if (enableNotifications && !notificationSoundRef.current) {
      notificationSoundRef.current = new Audio();
      // Create a gentle notification sound using Web Audio API
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } catch (error) {
        console.log('Audio context not available');
      }
    }
  }, [enableNotifications]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!enableNotifications) return;
    
    try {
      // Try to play system notification sound or create one
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8+ONQQ0PVqzn77BdGAg7k9n0xnkpBSuBzvLZiTYIF2fA6+eRSg0MRZvd8sFuIgg+ltryxHkpBSl4yO/WeDEHKIHO89qIOQgYarzt5ZdNEAo+k9jzymUnBSuBzvPZiDYIG2m98+GSUAwMRJzZ88V5KQUmecnv1ngxBityz/LZiDkIF2i+7eSeTxELPpHa88p2JwUmecnv1ngwByt0z/LYizUHHGu96eGRSAwJTZzb9MR5KQUsdsrw03UtByR3yO/WdTEHJoHK9NKQSA4JSJvZ88JyJAUme8nv1nYyBSR3x/PgklEODU6o4PO2YBoFMnTOhNjhynQpBS"');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Fallback - create a simple beep
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(520, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      });
    } catch (error) {
      console.log('Notification sound failed:', error);
    }
  }, [enableNotifications]);

  // Connection quality monitoring
  const startPingMonitoring = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        const pingStart = Date.now();
        socketRef.current.emit('ping_sanctuary', { timestamp: pingStart });
        
        const timeout = setTimeout(() => {
          setConnectionQuality(prev => ({
            ...prev,
            status: 'poor',
            latency: Date.now() - pingStart
          }));
        }, 5000);
        
        socketRef.current.once('pong_sanctuary', (data) => {
          clearTimeout(timeout);
          const latency = Date.now() - data.timestamp;
          
          let status: ConnectionQuality['status'] = 'excellent';
          if (latency > 1000) status = 'poor';
          else if (latency > 500) status = 'good';
          
          setConnectionQuality({
            status,
            latency,
            lastPing: Date.now()
          });
        });
      }
    }, 10000); // Ping every 10 seconds
  }, []);

  // Initialize socket connection with enhanced reconnection
  useEffect(() => {
    if (!sanctuaryId) return;
    
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const token = localStorage.getItem('auth_token');
    
    const socket = io(serverUrl, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10, // Increased attempts
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Sanctuary socket connected:', socket.id);
      setIsConnected(true);
      setConnectionQuality(prev => ({ ...prev, status: 'excellent' }));
      onConnectionChange?.(true);
      
      // Join sanctuary host room with enhanced error handling
      if (sanctuaryId && hostToken) {
        socket.emit('join_sanctuary_host', {
          sanctuaryId,
          hostToken
        });
      }
      
      startPingMonitoring();
    });

    socket.on('connect_error', (error) => {
      console.error('Sanctuary socket connection error:', error);
      setIsConnected(false);
      setConnectionQuality(prev => ({ ...prev, status: 'disconnected' }));
      onConnectionChange?.(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('Sanctuary socket disconnected:', reason);
      setIsConnected(false);
      setConnectionQuality(prev => ({ ...prev, status: 'disconnected' }));
      onConnectionChange?.(false);
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    });

    socket.on('reconnect', () => {
      console.log('Sanctuary socket reconnected');
      setIsConnected(true);
      setConnectionQuality(prev => ({ ...prev, status: 'excellent' }));
      onConnectionChange?.(true);
      
      // Rejoin sanctuary host room with latest token
      if (sanctuaryId && hostToken) {
        socket.emit('join_sanctuary_host', {
          sanctuaryId,
          hostToken
        });
      }
      
      startPingMonitoring();
      
      // Show reconnection success toast
      if (enableNotifications) {
        toast({
          title: '🔄 Reconnected',
          description: 'Real-time updates restored successfully',
          duration: 3000,
        });
      }
    });

    // Handle successful host room join
    socket.on('sanctuary_host_joined', (data) => {
      console.log('Successfully joined sanctuary host room:', data);
      setTotalSubmissions(data.submissionsCount || 0);
      
      // Store updated host token if provided
      if (data.hostToken && sanctuaryId) {
        localStorage.setItem(`sanctuary-host-${sanctuaryId}`, data.hostToken);
        sessionStorage.setItem(`sanctuary-host-${sanctuaryId}`, data.hostToken);
      }
      
      // Show connection success notification
      if (enableNotifications) {
        toast({
          title: '✅ Connected',
          description: 'Real-time inbox updates are now active',
          duration: 3000,
        });
      }
    });

    // Handle host authorization failure
    socket.on('sanctuary_host_auth_failed', (data) => {
      console.error('Sanctuary host auth failed:', data);
      toast({
        variant: 'destructive',
        title: 'Authorization Failed',
        description: 'Could not connect to sanctuary updates. You may not be the host.',
      });
    });

    // Handle real-time new submissions
    socket.on('sanctuary_new_submission', (data) => {
      console.log('New sanctuary submission received:', data);
      
      const submission = data.submission;
      setTotalSubmissions(data.totalSubmissions);
      
      // Play notification sound
      playNotificationSound();
      
      // Show toast notification
      if (enableNotifications) {
        toast({
          title: '📮 New Message',
          description: `From ${submission.alias}: ${submission.message.slice(0, 50)}${submission.message.length > 50 ? '...' : ''}`,
          duration: 5000,
        });

        // Browser notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Sanctuary Message', {
            body: `From ${submission.alias}`,
            icon: '/favicon-veilo.png',
            tag: sanctuaryId,
            requireInteraction: true
          });
        }
      }
      
      // Call callback
      onNewSubmission?.(submission);
    });

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      socket.disconnect();
    };
  }, [sanctuaryId, hostToken, onNewSubmission, onConnectionChange, enableNotifications, toast, playNotificationSound, startPingMonitoring]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  // Mark message as read
  const markMessageAsRead = useCallback((messageId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sanctuary_message_read', {
        sanctuaryId,
        messageId,
        hostToken
      });
    }
  }, [sanctuaryId, hostToken]);

  return {
    isConnected,
    connectionQuality,
    totalSubmissions,
    markMessageAsRead,
    requestNotificationPermission
  };
};