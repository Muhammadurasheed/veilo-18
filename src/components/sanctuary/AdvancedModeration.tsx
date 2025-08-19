import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Shield, 
  UserX, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Hand,
  Crown,
  AlertTriangle,
  Settings,
  Users,
  MessageSquare,
  Clock,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Participant {
  id: string;
  alias: string;
  isHost: boolean;
  isModerator: boolean;
  isMuted: boolean;
  isBlocked: boolean;
  handRaised: boolean;
  joinedAt: string;
  connectionStatus: 'connected' | 'poor' | 'disconnected';
  audioLevel: number;
  speakingTime: number;
}

interface AdvancedModerationProps {
  participants: Participant[];
  currentUserId: string;
  sessionId: string;
  onMuteParticipant: (id: string) => void;
  onKickParticipant: (id: string) => void;
  onPromoteToModerator: (id: string) => void;
  onBlockParticipant: (id: string) => void;
  onUnblockParticipant: (id: string) => void;
  onSetSpeakerTime: (id: string, timeLimit: number) => void;
  onToggleSession: (setting: string, value: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
}

const AdvancedModeration: React.FC<AdvancedModerationProps> = ({
  participants,
  currentUserId,
  sessionId,
  onMuteParticipant,
  onKickParticipant,
  onPromoteToModerator,
  onBlockParticipant,
  onUnblockParticipant,
  onSetSpeakerTime,
  onToggleSession,
  isOpen,
  onClose
}) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [autoMuteThreshold, setAutoMuteThreshold] = useState([80]);
  const [speakerTimeLimit, setSpeakerTimeLimit] = useState([300]); // 5 minutes default
  const [maxParticipants, setMaxParticipants] = useState([50]);
  
  // Session settings
  const [sessionSettings, setSessionSettings] = useState({
    mutedJoin: false,
    handRaiseRequired: true,
    autoKickInactive: false,
    recordSession: false,
    allowAnonymous: true,
    moderatorApproval: false
  });

  const filteredParticipants = participants.filter(p => 
    p.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.includes(searchTerm)
  );

  const getParticipantStats = () => {
    const total = participants.length;
    const muted = participants.filter(p => p.isMuted).length;
    const handRaised = participants.filter(p => p.handRaised).length;
    const moderators = participants.filter(p => p.isModerator).length;
    const blocked = participants.filter(p => p.isBlocked).length;
    
    return { total, muted, handRaised, moderators, blocked };
  };

  const stats = getParticipantStats();

  const handleBulkAction = useCallback((action: string) => {
    const selectedParticipants = filteredParticipants.filter(p => !p.isHost && p.id !== currentUserId);
    
    switch (action) {
      case 'muteAll':
        selectedParticipants.forEach(p => {
          if (!p.isMuted) onMuteParticipant(p.id);
        });
        toast({
          title: "Bulk Mute Applied",
          description: `Muted ${selectedParticipants.filter(p => !p.isMuted).length} participants`,
        });
        break;
        
      case 'kickInactive':
        const inactiveParticipants = selectedParticipants.filter(p => 
          p.connectionStatus === 'disconnected' || p.speakingTime === 0
        );
        inactiveParticipants.forEach(p => onKickParticipant(p.id));
        toast({
          title: "Inactive Participants Removed",
          description: `Removed ${inactiveParticipants.length} inactive participants`,
        });
        break;
        
      case 'clearHands':
        // This would clear all raised hands in the actual implementation
        toast({
          title: "Hands Cleared",
          description: "All raised hands have been cleared",
        });
        break;
    }
  }, [filteredParticipants, currentUserId, onMuteParticipant, onKickParticipant, toast]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500';
      case 'poor': return 'text-yellow-500';
      case 'disconnected': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Advanced Moderation</span>
            <Badge variant="outline" className="ml-2">
              {stats.total} participants
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="participants" className="flex-1">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="participants" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Participants</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="emergency" className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Emergency</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="participants" className="space-y-4">
            {/* Search and Bulk Actions */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <Input
                  placeholder="Search participants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('muteAll')}>
                  <MicOff className="h-4 w-4 mr-2" />
                  Mute All
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('kickInactive')}>
                  <UserX className="h-4 w-4 mr-2" />
                  Remove Inactive
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('clearHands')}>
                  <Hand className="h-4 w-4 mr-2" />
                  Clear Hands
                </Button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-5 gap-4">
              <Card className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{stats.muted}</div>
                  <div className="text-xs text-muted-foreground">Muted</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{stats.handRaised}</div>
                  <div className="text-xs text-muted-foreground">Hands Up</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.moderators}</div>
                  <div className="text-xs text-muted-foreground">Moderators</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{stats.blocked}</div>
                  <div className="text-xs text-muted-foreground">Blocked</div>
                </div>
              </Card>
            </div>

            {/* Participants List */}
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-96">
                  <div className="space-y-2 p-4">
                    {filteredParticipants.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {participant.alias.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            {participant.isHost && (
                              <Crown className="absolute -top-1 -right-1 h-3 w-3 text-yellow-500" />
                            )}
                            {participant.handRaised && (
                              <Hand className="absolute -bottom-1 -right-1 h-3 w-3 text-yellow-500" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium truncate">{participant.alias}</p>
                              {participant.isHost && (
                                <Badge variant="default" className="text-xs">Host</Badge>
                              )}
                              {participant.isModerator && (
                                <Badge variant="secondary" className="text-xs">Mod</Badge>
                              )}
                              {participant.isBlocked && (
                                <Badge variant="destructive" className="text-xs">Blocked</Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                              <span className={getConnectionStatusColor(participant.connectionStatus)}>
                                ● {participant.connectionStatus}
                              </span>
                              <span>Speaking: {formatDuration(participant.speakingTime)}</span>
                              <span>Audio: {Math.round(participant.audioLevel)}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {!participant.isHost && participant.id !== currentUserId && (
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onMuteParticipant(participant.id)}
                              className={participant.isMuted ? 'text-red-500' : ''}
                            >
                              {participant.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                            </Button>
                            
                            {!participant.isModerator && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onPromoteToModerator(participant.id)}
                                title="Promote to Moderator"
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => participant.isBlocked ? onUnblockParticipant(participant.id) : onBlockParticipant(participant.id)}
                              className={participant.isBlocked ? 'text-green-500' : 'text-yellow-500'}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onKickParticipant(participant.id)}
                              className="text-red-500"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            {/* Session Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Session Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label>Muted Join</Label>
                    <Switch
                      checked={sessionSettings.mutedJoin}
                      onCheckedChange={(checked) => {
                        setSessionSettings(prev => ({ ...prev, mutedJoin: checked }));
                        onToggleSession('mutedJoin', checked);
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Hand Raise Required</Label>
                    <Switch
                      checked={sessionSettings.handRaiseRequired}
                      onCheckedChange={(checked) => {
                        setSessionSettings(prev => ({ ...prev, handRaiseRequired: checked }));
                        onToggleSession('handRaiseRequired', checked);
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Auto Kick Inactive</Label>
                    <Switch
                      checked={sessionSettings.autoKickInactive}
                      onCheckedChange={(checked) => {
                        setSessionSettings(prev => ({ ...prev, autoKickInactive: checked }));
                        onToggleSession('autoKickInactive', checked);
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Record Session</Label>
                    <Switch
                      checked={sessionSettings.recordSession}
                      onCheckedChange={(checked) => {
                        setSessionSettings(prev => ({ ...prev, recordSession: checked }));
                        onToggleSession('recordSession', checked);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audio Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Audio Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Auto-Mute Threshold: {autoMuteThreshold[0]}%</Label>
                  <Slider
                    value={autoMuteThreshold}
                    onValueChange={setAutoMuteThreshold}
                    max={100}
                    min={50}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Automatically mute participants with audio levels above this threshold
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Speaker Time Limit: {Math.floor(speakerTimeLimit[0] / 60)}:{(speakerTimeLimit[0] % 60).toString().padStart(2, '0')}</Label>
                  <Slider
                    value={speakerTimeLimit}
                    onValueChange={setSpeakerTimeLimit}
                    max={1800} // 30 minutes
                    min={60} // 1 minute
                    step={30}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum speaking time per participant
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Max Participants: {maxParticipants[0]}</Label>
                  <Slider
                    value={maxParticipants}
                    onValueChange={setMaxParticipants}
                    max={200}
                    min={5}
                    step={5}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Session Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatDuration(participants.reduce((sum, p) => sum + p.speakingTime, 0))}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Speaking Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(participants.reduce((sum, p) => sum + p.audioLevel, 0) / participants.length)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Avg Audio Level</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {participants.filter(p => p.connectionStatus === 'connected').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Active Connections</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emergency" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span>Emergency Controls</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="destructive" className="w-full">
                    Emergency Session End
                  </Button>
                  <Button variant="outline" className="w-full border-red-300 text-red-600">
                    Mute All Immediately
                  </Button>
                  <Button variant="outline" className="w-full border-orange-300 text-orange-600">
                    Pause Session
                  </Button>
                  <Button variant="outline" className="w-full border-blue-300 text-blue-600">
                    Contact Support
                  </Button>
                </div>
                
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-700 dark:text-red-300">Emergency Protocol</h4>
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        Use these controls only in emergency situations. All actions are logged and monitored.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedModeration;