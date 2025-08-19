import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Layout from '@/components/layout/Layout';
import { ArrowLeft, Copy, ExternalLink, MessageCircle, Clock, Users, Flag, X, Wifi, WifiOff, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import EnhancedSanctuaryFlow from '@/components/sanctuary/EnhancedSanctuaryFlow';
import { SanctuaryApi } from '@/services/api';
import { SEOHead } from '@/components/seo/SEOHead';
import { useSanctuaryRealtime } from '@/hooks/useSanctuaryRealtime';
import { Switch } from '@/components/ui/switch';

interface Submission {
  id: string;
  alias: string;
  message: string;
  timestamp: string;
}

interface SanctuarySession {
  id: string;
  topic: string;
  description?: string;
  emoji?: string;
  mode: string;
  createdAt: string;
  expiresAt: string;
}

interface SanctuaryInboxData {
  session: SanctuarySession;
  submissions: Submission[];
}

const SanctuaryInbox = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Enhanced host verification using the new hook
  const [isValidatingHost, setIsValidatingHost] = useState(true);
  const [hostError, setHostError] = useState<string | null>(null);

  // Get host token from multiple sources
  const getHostTokenFromSources = useCallback(() => {
    if (!sessionId) return null;
    
    // Priority order: URL params > localStorage > sessionStorage > cookie
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('hostToken');
    const tokenFromStorage = localStorage.getItem(`sanctuary-host-${sessionId}`);
    const tokenFromSession = sessionStorage.getItem(`sanctuary-host-${sessionId}`);
    
    // Try cookie as last resort
    const cookieName = `sanctuary-host-${sessionId}=`;
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    let tokenFromCookie = null;
    
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(cookieName) === 0) {
        tokenFromCookie = c.substring(cookieName.length, c.length);
        break;
      }
    }
    
    return tokenFromUrl || tokenFromStorage || tokenFromSession || tokenFromCookie;
  }, [sessionId]);

  // Verify host status on mount
  useEffect(() => {
    const verifyHostStatus = async () => {
      if (!sessionId) return;
      
      const token = getHostTokenFromSources();
      
      if (!token) {
        setHostError('No host access found');
        setIsValidatingHost(false);
        return;
      }

      try {
        const response = await fetch('/api/host-recovery/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostToken: token }),
        });

        const data = await response.json();
        
        if (data.success) {
          // Store token in all locations for persistence
          localStorage.setItem(`sanctuary-host-${sessionId}`, token);
          sessionStorage.setItem(`sanctuary-host-${sessionId}`, token);
          setHostError(null);
        } else {
          setHostError(data.error || 'Invalid host token');
        }
      } catch (error) {
        setHostError('Failed to verify host status');
      } finally {
        setIsValidatingHost(false);
      }
    };

    verifyHostStatus();
  }, [sessionId, getHostTokenFromSources]);

  // Show loading while validating host
  if (isValidatingHost) {
    return (
      <Layout>
        <div className="container py-10">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-pulse text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-full mx-auto mb-4 animate-spin"></div>
              <p className="text-muted-foreground">Verifying host access...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // If not host, show join flow
  if (hostError || !getHostTokenFromSources()) {
    return sessionId ? <EnhancedSanctuaryFlow sessionId={sessionId} sessionType="inbox" /> : null;
  }
  const [inboxData, setInboxData] = useState<SanctuaryInboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Enhanced token retrieval with persistence
  const getHostToken = useCallback(() => {
    return getHostTokenFromSources();
  }, [getHostTokenFromSources]);

  const fetchInboxData = useCallback(async (showLoading = false) => {
    if (!sessionId) return;
    
    try {
      if (showLoading) setLoading(true);
      const hostToken = getHostToken();
      
      const response = await SanctuaryApi.getSubmissions(sessionId, hostToken || undefined);
      
      if (response.success && response.data) {
        setInboxData(response.data);
        setLastRefresh(new Date());
        setError(null);
      } else {
        setError(response.error || 'Failed to load inbox');
      }
    } catch (err: any) {
      console.error('Fetch inbox error:', err);
      setError('Failed to connect to server');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [sessionId]);

  // Handle real-time new submissions
  const handleNewSubmission = useCallback((submission: any) => {
    setInboxData(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        submissions: [...prev.submissions, submission]
      };
    });
  }, []);

  // Handle connection status changes
  const handleConnectionChange = useCallback((connected: boolean) => {
    if (!connected) {
      toast({
        variant: 'destructive',
        title: 'Connection Lost',
        description: 'Real-time updates temporarily unavailable. Retrying...',
      });
    }
  }, [toast]);

  // Initialize real-time connection
  const { 
    isConnected, 
    connectionQuality, 
    totalSubmissions,
    markMessageAsRead,
    requestNotificationPermission 
  } = useSanctuaryRealtime({
    sanctuaryId: sessionId || '',
    hostToken: getHostToken() || undefined,
    onNewSubmission: handleNewSubmission,
    onConnectionChange: handleConnectionChange,
    enableNotifications: notificationsEnabled
  });

  useEffect(() => {
    fetchInboxData(true);
  }, [fetchInboxData]);

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/sanctuary/submit/${sessionId}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link copied!",
      description: "Share this link to collect anonymous messages.",
    });
  };

  const copyToSocial = (platform: 'whatsapp' | 'twitter') => {
    const shareUrl = `${window.location.origin}/sanctuary/submit/${sessionId}`;
    const text = `📮 Send me an anonymous message about: ${inboxData?.session?.topic}`;
    
    let socialUrl = '';
    if (platform === 'whatsapp') {
      socialUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${shareUrl}`)}`;
    } else if (platform === 'twitter') {
      socialUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    }
    
    window.open(socialUrl, '_blank');
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-10">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-pulse text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading your sanctuary inbox...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !inboxData) {
    return (
      <Layout>
        <div className="container py-10">
          <div className="text-center min-h-[400px] flex flex-col items-center justify-center">
            <X className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Inbox not found</h2>
            <p className="text-muted-foreground mb-6">{error || 'This sanctuary session may have expired or been removed.'}</p>
            <Link to="/sanctuary">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Create New Sanctuary
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const { session, submissions } = inboxData;

  return (
    <Layout>
      <SEOHead
        title={`Sanctuary Inbox - ${inboxData?.session?.topic || 'Anonymous Messages'} | Veilo`}
        description="Manage your anonymous sanctuary messages and maintain a safe space for open communication"
        keywords="sanctuary inbox, anonymous messages, safe space management"
      />
      <div className="container py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/sanctuary">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sanctuary
            </Button>
          </Link>
          <div className="flex items-center space-x-3">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <div className="flex items-center space-x-1">
                  <Wifi className={`w-4 h-4 ${
                    connectionQuality.status === 'excellent' ? 'text-green-500' :
                    connectionQuality.status === 'good' ? 'text-yellow-500' :
                    connectionQuality.status === 'poor' ? 'text-orange-500' :
                    'text-red-500'
                  }`} />
                  <span className="text-xs text-muted-foreground">
                    {connectionQuality.latency > 0 ? `${connectionQuality.latency}ms` : 'Live'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-1">
                  <WifiOff className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-500">Offline</span>
                </div>
              )}
            </div>
            
            <Badge variant={session.mode === 'anon-inbox' ? 'default' : 'secondary'}>
              <MessageCircle className="w-3 h-3 mr-1" />
              Anonymous Inbox
            </Badge>
          </div>
        </div>

        {/* Real-time Controls */}
        <Card className="mb-6 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium">
                    {isConnected ? 'Live Updates Active' : 'Connection Lost'}
                  </span>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Last refresh: {lastRefresh.toLocaleTimeString()}
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Notification Toggle */}
                <div className="flex items-center space-x-2">
                  <label htmlFor="notifications" className="text-sm">
                    Notifications
                  </label>
                  {notificationsEnabled ? (
                    <Volume2 className="w-4 h-4 text-blue-600" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-muted-foreground" />
                  )}
                  <Switch
                    id="notifications"
                    checked={notificationsEnabled}
                    onCheckedChange={(checked) => {
                      setNotificationsEnabled(checked);
                      if (checked) {
                        requestNotificationPermission();
                      }
                    }}
                  />
                </div>
                
                {/* Manual Refresh */}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fetchInboxData(false)}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session Info */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {session.emoji && (
                  <span className="text-2xl">{session.emoji}</span>
                )}
                <div>
                  <CardTitle className="text-xl">{session.topic}</CardTitle>
                  {session.description && (
                    <p className="text-muted-foreground mt-1">{session.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  <Users className="w-3 h-3 mr-1" />
                  {submissions.length}
                  {isConnected && totalSubmissions !== submissions.length && (
                    <span className="ml-1 text-blue-600">({totalSubmissions} total)</span>
                  )}
                </Badge>
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  Expires {new Date(session.expiresAt).toLocaleDateString()}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copyShareLink} size="sm">
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Button onClick={() => copyToSocial('whatsapp')} variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                Share on WhatsApp
              </Button>
              <Button onClick={() => copyToSocial('twitter')} variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                Share on Twitter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center">
              <MessageCircle className="w-5 h-5 mr-2" />
              Anonymous Messages ({submissions.length})
              {isConnected && (
                <Badge variant="secondary" className="ml-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1" />
                  Live
                </Badge>
              )}
            </h2>
            
            {isConnected && totalSubmissions > submissions.length && (
              <Badge variant="outline" className="text-blue-600">
                {totalSubmissions - submissions.length} new messages available
              </Badge>
            )}
          </div>

          {submissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-medium mb-2">No messages yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Share your link to start receiving anonymous messages
                </p>
                <Button onClick={copyShareLink} size="sm">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Share Link
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <Card key={submission.id} className="relative">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {submission.alias.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{submission.alias}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(submission.timestamp)}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="opacity-50 hover:opacity-100">
                        <Flag className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {submission.message}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SanctuaryInbox;