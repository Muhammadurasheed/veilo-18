import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Mail, Link as LinkIcon, Copy, ExternalLink, Clock, RefreshCw } from 'lucide-react';

interface HostSessionRecoveryProps {
  sanctuaryId: string;
  hostToken?: string;
}

const HostSessionRecovery: React.FC<HostSessionRecoveryProps> = ({ sanctuaryId, hostToken }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  // Generate recovery link
  const generateRecoveryLink = async () => {
    if (!hostToken) {
      toast({
        variant: 'destructive',
        title: 'No Host Token',
        description: 'Cannot generate recovery link without valid host token.',
      });
      return;
    }

    try {
      setIsGenerating(true);

      const response = await fetch('/api/host-recovery/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sanctuaryId,
          hostToken,
          recoveryEmail: email || undefined
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRecoveryUrl(data.data.recoveryUrl);
        toast({
          title: '🔗 Recovery Link Generated',
          description: 'Your sanctuary recovery link is ready!',
        });
      } else {
        throw new Error(data.error || 'Failed to generate recovery link');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error.message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy recovery URL
  const copyRecoveryUrl = () => {
    if (recoveryUrl) {
      navigator.clipboard.writeText(recoveryUrl);
      toast({
        title: '📋 Copied!',
        description: 'Recovery link copied to clipboard',
      });
    }
  };

  // Share via email
  const shareViaEmail = () => {
    if (recoveryUrl && sessionInfo) {
      const subject = `Sanctuary Host Recovery - ${sessionInfo.topic}`;
      const body = `Your sanctuary host recovery link:\n\n${recoveryUrl}\n\nThis link will allow you to regain access to your sanctuary inbox for "${sessionInfo.topic}".`;
      window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    }
  };

  // Get current session info
  React.useEffect(() => {
    const fetchSessionInfo = async () => {
      if (!hostToken) return;

      try {
        const response = await fetch('/api/host-recovery/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostToken }),
        });

        const data = await response.json();
        if (data.success) {
          setSessionInfo(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch session info:', error);
      }
    };

    fetchSessionInfo();
  }, [hostToken]);

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Sanctuary Host Recovery
        </CardTitle>
        <CardDescription>
          Generate a secure recovery link to access your sanctuary inbox from any device.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {sessionInfo && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {sessionInfo.emoji && (
                  <span className="text-2xl">{sessionInfo.emoji}</span>
                )}
                <div>
                  <h3 className="font-medium">{sessionInfo.topic}</h3>
                  {sessionInfo.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {sessionInfo.description}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="outline">
                <Clock className="w-3 h-3 mr-1" />
                {sessionInfo.submissionsCount || 0} messages
              </Badge>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Recovery Email (Optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="your-email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Add your email to receive the recovery link and for future reference.
            </p>
          </div>

          <Button 
            onClick={generateRecoveryLink}
            disabled={isGenerating || !hostToken}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4 mr-2" />
                Generate Recovery Link
              </>
            )}
          </Button>
        </div>

        {recoveryUrl && (
          <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Recovery Link Generated
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="p-3 bg-white dark:bg-gray-900 border rounded text-sm font-mono break-all">
                {recoveryUrl}
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={copyRecoveryUrl} size="sm" variant="outline">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                
                {email && (
                  <Button onClick={shareViaEmail} size="sm" variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </Button>
                )}
                
                <Button 
                  onClick={() => window.open(recoveryUrl, '_blank')} 
                  size="sm" 
                  variant="outline"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Test
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>💡 <strong>Save this link</strong> to access your sanctuary from any device</p>
              <p>⏰ This link will expire when your sanctuary session ends</p>
              <p>🔒 Keep this link private - it grants full host access</p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button 
          variant="outline" 
          onClick={() => navigate(`/sanctuary/inbox/${sanctuaryId}`)}
          className="w-full"
        >
          Back to Inbox
        </Button>
      </CardFooter>
    </Card>
  );
};

export default HostSessionRecovery;