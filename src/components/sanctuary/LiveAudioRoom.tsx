import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAgoraAudio } from '@/hooks/useAgoraAudio';
import { useSanctuarySocket } from '@/hooks/useSocket';
import AudioQualityMonitor from './AudioQualityMonitor';
import SanctuaryAudioSettings from './SanctuaryAudioSettings';
import AdvancedModeration from './AdvancedModeration';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Hand,
  Shield,
  AlertTriangle,
  Settings,
  Users,
  LogOut,
  MoreVertical,
  UserX,
  MessageSquare
} from 'lucide-react';
import { LiveSanctuarySession, LiveParticipant, EmojiReaction } from '@/types/sanctuary';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveAudioRoomProps {
  session: LiveSanctuarySession;
  participant: {
    id: string;
    alias: string;
    isHost: boolean;
    isModerator: boolean;
  };
}

const LiveAudioRoom = ({ session, participant }: LiveAudioRoomProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Agora Audio Hook configuration
  const agoraConfig = {
    sessionId: session.id,
    uid: participant.id
  };
  
  const {
    isConnected,
    isLoading,
    connectionQuality,
    isMuted,
    participants: agoraParticipants,
    audioStats,
    connect,
    disconnect,
    toggleMicrophone,
    adjustVolume
  } = useAgoraAudio(agoraConfig);
  
  // Socket for real-time updates
  const { sendMessage } = useSanctuarySocket(session.id, participant);
  
  // Local state
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [speakerQueue, setSpeakerQueue] = useState<string[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [emojiReactions, setEmojiReactions] = useState<EmojiReaction[]>([]);
  const [showModeration, setShowModeration] = useState(false);
  const [showAdvancedModeration, setShowAdvancedModeration] = useState(false);
  const [volume, setVolume] = useState(50);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  
  // Audio device management
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  
  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Sync Agora participants with local state
  useEffect(() => {
    setParticipants(prev => {
      const updated = [...prev];
      
      // Add new Agora participants
      agoraParticipants.forEach(agoraP => {
        const existing = updated.find(p => p.id === String(agoraP.uid));
        if (!existing) {
          updated.push({
            id: String(agoraP.uid),
            alias: agoraP.alias,
            isHost: participant.isHost && String(agoraP.uid) === participant.id,
            isModerator: false,
            isMuted: agoraP.isMuted,
            isBlocked: false,
            handRaised: false,
            joinedAt: new Date().toISOString(),
            connectionStatus: 'connected',
            audioLevel: agoraP.audioLevel,
            speakingTime: 0
          });
        } else {
          // Update existing participant
          existing.isMuted = agoraP.isMuted;
          existing.audioLevel = agoraP.audioLevel;
          existing.connectionStatus = 'connected';
        }
      });
      
      return updated;
    });
  }, [agoraParticipants, participant]);

  const handleRaiseHand = useCallback(() => {
    setHandRaised(!handRaised);
    sendMessage(
      handRaised ? 'lowered their hand' : 'raised their hand',
      'text'
    );
    
    toast({
      title: handRaised ? "Hand Lowered" : "Hand Raised",
      description: handRaised 
        ? "You lowered your hand" 
        : "Your request to speak has been sent to the host",
    });
  }, [handRaised, sendMessage, toast]);

  const handlePromoteToSpeaker = useCallback((participantId: string) => {
    if (!participant.isHost && !participant.isModerator) return;
    
    setSpeakerQueue(prev => prev.filter(id => id !== participantId));
    setCurrentSpeaker(participantId);
    
    // In a real implementation, this would send socket message to promote user
    toast({
      title: "Speaker Promoted",
      description: "Participant can now speak",
    });
  }, [participant, toast]);

  const handleMuteParticipant = useCallback((participantId: string) => {
    if (!participant.isHost && !participant.isModerator) return;
    
    // In real implementation, this would mute the participant via Agora
    setParticipants(prev => 
      prev.map(p => 
        p.id === participantId ? { ...p, isMuted: true } : p
      )
    );
    
    toast({
      title: "Participant Muted",
      description: "Participant has been muted by moderator",
    });
  }, [participant, toast]);

  const handleKickParticipant = useCallback((participantId: string) => {
    if (!participant.isHost && !participant.isModerator) return;
    
    setParticipants(prev => prev.filter(p => p.id !== participantId));
    
    toast({
      title: "Participant Removed",
      description: "Participant has been removed from the session",
    });
  }, [participant, toast]);

  const handleSendEmojiReaction = useCallback((emoji: string) => {
    const reaction: EmojiReaction = {
      id: Date.now().toString(),
      participantId: participant.id,
      emoji,
      timestamp: new Date().toISOString(),
      duration: 3000
    };
    
    setEmojiReactions(prev => [...prev, reaction]);
    sendMessage(`reacted with ${emoji}`, 'emoji-reaction');
    
    // Auto-remove after duration
    setTimeout(() => {
      setEmojiReactions(prev => prev.filter(r => r.id !== reaction.id));
    }, reaction.duration);
  }, [participant.id, sendMessage]);

  const handleEmergencyAlert = useCallback(() => {
    setShowEmergencyDialog(true);
  }, []);

  const handleLeaveRoom = useCallback(async () => {
    await disconnect();
    navigate('/sanctuary');
    toast({
      title: "Left Sanctuary",
      description: "You have left the audio sanctuary",
    });
  }, [disconnect, navigate, toast]);

  const getAudioLevelColor = (level: number) => {
    if (level > 80) return 'bg-red-500';
    if (level > 60) return 'bg-orange-500';
    if (level > 40) return 'bg-yellow-500';
    if (level > 20) return 'bg-blue-500';
    return 'bg-gray-300';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Card className="mb-6 glass shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-3xl">{session.emoji || '🏛️'}</div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-800">
                    {session.topic}
                  </CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {participants.length} / {session.maxParticipants} participants
                    </Badge>
                    <AudioQualityMonitor 
                      audioStats={audioStats}
                      connectionQuality={connectionQuality}
                      isConnected={isConnected}
                      className="ml-2"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <SanctuaryAudioSettings
                  currentVolume={volume}
                  onVolumeChange={setVolume}
                />
                {participant.isHost && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowModeration(true)}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Moderate
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEmergencyAlert}
                  className="text-red-600 border-red-300"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Emergency
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleLeaveRoom}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Audio Controls */}
          <div className="lg:col-span-3 space-y-6">
            {/* Audio Controls */}
            <Card className="glass shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center space-x-6">
                  {/* Microphone Toggle */}
                  <div className="text-center">
                    <Button
                      onClick={toggleMicrophone}
                      disabled={isLoading}
                      size="lg"
                      className={`h-16 w-16 rounded-full ${
                        isMuted 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </Button>
                    <p className="text-xs mt-2 text-gray-600">
                      {isMuted ? 'Unmute' : 'Mute'}
                    </p>
                  </div>

                  {/* Audio Level */}
                  <div className="text-center flex-1 max-w-xs">
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600">Audio Level</p>
                      <Progress 
                        value={audioStats.audioLevel} 
                        className="h-2"
                      />
                      <p className="text-xs text-gray-500">
                        {Math.round(audioStats.audioLevel)}%
                      </p>
                    </div>
                  </div>

                  {/* Hand Raise */}
                  <div className="text-center">
                    <Button
                      onClick={handleRaiseHand}
                      variant={handRaised ? "default" : "outline"}
                      size="lg"
                      className="h-16 w-16 rounded-full"
                    >
                      <Hand className={`h-6 w-6 ${handRaised ? 'text-yellow-500' : ''}`} />
                    </Button>
                    <p className="text-xs mt-2 text-gray-600">
                      {handRaised ? 'Lower Hand' : 'Raise Hand'}
                    </p>
                  </div>
                </div>

                {/* Volume Control */}
                <div className="mt-6 flex items-center space-x-4">
                  <VolumeX className="h-4 w-4 text-gray-400" />
                  <div className="flex-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <Volume2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600 w-12">{volume}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Emoji Reactions */}
            <Card className="glass shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Quick Reactions</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {['👏', '❤️', '😊', '🤔', '👍', '🙏', '💪', '🌟'].map(emoji => (
                    <Button
                      key={emoji}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendEmojiReaction(emoji)}
                      className="text-xl hover:scale-110 transition-transform"
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Current Speaker */}
            {currentSpeaker && (
              <Card className="glass shadow-lg border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={`/avatars/avatar-1.svg`} />
                        <AvatarFallback>
                          {participants.find(p => p.id === currentSpeaker)?.alias?.substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Currently Speaking</p>
                      <p className="text-sm text-gray-600">
                        {participants.find(p => p.id === currentSpeaker)?.alias || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Participants Sidebar */}
          <div className="space-y-6">
            {/* Participants List */}
            <Card className="glass shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Participants ({participants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={`/avatars/avatar-${p.avatarIndex || 1}.svg`} />
                              <AvatarFallback className="text-xs">
                                {p.alias.substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            {/* Speaking indicator */}
                            {p.audioLevel > 20 && (
                              <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1">
                              <p className="text-sm font-medium truncate">{p.alias}</p>
                              {p.isHost && (
                                <Badge variant="secondary" className="text-xs">Host</Badge>
                              )}
                              {p.isModerator && (
                                <Shield className="h-3 w-3 text-blue-500" />
                              )}
                            </div>
                            {p.handRaised && (
                              <div className="flex items-center space-x-1">
                                <Hand className="h-3 w-3 text-yellow-500" />
                                <span className="text-xs text-yellow-600">Hand raised</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          {p.isMuted ? (
                            <MicOff className="h-4 w-4 text-red-500" />
                          ) : (
                            <div className={`h-2 w-8 rounded ${getAudioLevelColor(p.audioLevel)}`} />
                          )}
                          
                          {(participant.isHost || participant.isModerator) && p.id !== participant.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMuteParticipant(p.id)}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Speaker Queue */}
            {speakerQueue.length > 0 && (participant.isHost || participant.isModerator) && (
              <Card className="glass shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Speaker Queue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {speakerQueue.map((participantId, index) => {
                      const p = participants.find(participant => participant.id === participantId);
                      return (
                        <div key={participantId} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{index + 1}.</span>
                            <span className="text-sm">{p?.alias}</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handlePromoteToSpeaker(participantId)}
                          >
                            Promote
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Floating Emoji Reactions */}
        <AnimatePresence>
          {emojiReactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 0, y: 50, scale: 0.5 }}
              animate={{ opacity: 1, y: -100, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 2 }}
              className="fixed bottom-20 right-20 text-4xl pointer-events-none z-50"
            >
              {reaction.emoji}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Emergency Dialog */}
        <Dialog open={showEmergencyDialog} onOpenChange={setShowEmergencyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Emergency Alert
              </DialogTitle>
              <DialogDescription>
                This will immediately alert moderators and support staff. Use only for genuine emergencies.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <Button variant="destructive" className="flex-col h-20">
                <AlertTriangle className="h-6 w-6 mb-2" />
                Safety Concern
              </Button>
              <Button variant="destructive" className="flex-col h-20">
                <UserX className="h-6 w-6 mb-2" />
                Harassment
              </Button>
              <Button variant="destructive" className="flex-col h-20">
                <MessageSquare className="h-6 w-6 mb-2" />
                Technical Issue
              </Button>
              <Button variant="destructive" className="flex-col h-20">
                <Shield className="h-6 w-6 mb-2" />
                Other Emergency
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default LiveAudioRoom;