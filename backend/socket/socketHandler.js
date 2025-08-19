const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

const initializeSocket = (server) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_2,
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        // Allow anonymous connections for public spaces
        socket.userId = `anonymous_${socket.id}`;
        socket.isAnonymous = true;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({ id: decoded.user.id });
      
      if (!user) {
        return next(new Error('Authentication error'));
      }

      socket.userId = user.id;
      socket.userAlias = user.alias;
      socket.userAvatarIndex = user.avatarIndex;
      socket.isAnonymous = false;
      
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.userAlias || 'Anonymous'})`);

    // Handle joining chat sessions
    socket.on('join_chat', async (data) => {
      const { sessionId, userType } = data;
      
      socket.join(`chat_${sessionId}`);
      socket.currentChatSession = sessionId;
      
      // Notify other participants
      socket.to(`chat_${sessionId}`).emit('user_joined', {
        userId: socket.userId,
        userAlias: socket.userAlias,
        userType,
        timestamp: new Date().toISOString()
      });
      
      console.log(`User ${socket.userId} joined chat session ${sessionId}`);
    });

    // Handle chat messages
    socket.on('send_message', async (data) => {
      const { sessionId, content, type = 'text', attachment } = data;
      
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sender: {
          id: socket.userId,
          alias: socket.userAlias || 'Anonymous',
          avatarIndex: socket.userAvatarIndex,
          isExpert: data.isExpert || false
        },
        content,
        type,
        attachment,
        timestamp: new Date().toISOString(),
        sessionId
      };

      // Broadcast to all participants in the session
      io.to(`chat_${sessionId}`).emit('new_message', message);
      
      // TODO: Save message to database
      console.log(`Message sent in session ${sessionId}:`, content);
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { sessionId } = data;
      socket.to(`chat_${sessionId}`).emit('user_typing', {
        userId: socket.userId,
        userAlias: socket.userAlias,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      const { sessionId } = data;
      socket.to(`chat_${sessionId}`).emit('user_typing', {
        userId: socket.userId,
        userAlias: socket.userAlias,
        isTyping: false
      });
    });

    // Handle sanctuary spaces
    socket.on('join_sanctuary', async (data) => {
      const { sanctuaryId, participant } = data;
      
      socket.join(`sanctuary_${sanctuaryId}`);
      socket.currentSanctuary = sanctuaryId;
      
      // Notify other participants
      socket.to(`sanctuary_${sanctuaryId}`).emit('participant_joined', {
        participant: {
          id: socket.userId,
          alias: participant.alias || socket.userAlias || 'Anonymous',
          joinedAt: new Date().toISOString(),
          isAnonymous: socket.isAnonymous || participant.isAnonymous
        }
      });
      
      console.log(`User ${socket.userId} joined sanctuary ${sanctuaryId}`);
    });

    // Handle joining sanctuary as host for real-time inbox updates
    socket.on('join_sanctuary_host', async (data) => {
      const { sanctuaryId, hostToken } = data;
      
      // Verify host authorization using HostSession model for persistence
      const HostSession = require('../models/HostSession');
      const SanctuarySession = require('../models/SanctuarySession');
      let hostSession;
      let sanctuarySession;
      
      try {
        // First, try to find active host session by token
        if (hostToken) {
          hostSession = await HostSession.findOne({ 
            hostToken,
            sanctuaryId,
            isActive: true,
            expiresAt: { $gt: new Date() }
          });
        }
        
        // If no host session found and user is authenticated, check by user ID
        if (!hostSession && !socket.isAnonymous) {
          sanctuarySession = await SanctuarySession.findOne({
            id: sanctuaryId,
            hostId: socket.userId,
            isActive: true,
            expiresAt: { $gt: new Date() }
          });
          
          if (sanctuarySession) {
            // Create host session for authenticated user
            hostSession = new HostSession({
              sanctuaryId,
              hostToken: hostToken || require('nanoid').nanoid(32),
              hostId: socket.userId,
              hostIp: socket.handshake.address,
              userAgent: socket.handshake.headers['user-agent'],
              expiresAt: sanctuarySession.expiresAt
            });
            await hostSession.save();
          }
        }
        
        if (hostSession) {
          // Update last access
          await hostSession.updateAccess();
          
          // Get sanctuary session if not already loaded
          if (!sanctuarySession) {
            sanctuarySession = await SanctuarySession.findOne({
              id: sanctuaryId,
              isActive: true,
              expiresAt: { $gt: new Date() }
            });
          }
          
          if (sanctuarySession) {
            socket.join(`sanctuary_host_${sanctuaryId}`);
            socket.currentSanctuaryHost = sanctuaryId;
            socket.hostToken = hostSession.hostToken;
            
            // Send current submissions count and session info
            socket.emit('sanctuary_host_joined', {
              sanctuaryId,
              submissionsCount: sanctuarySession.submissions?.length || 0,
              lastActivity: sanctuarySession.submissions?.length > 0 ? 
                sanctuarySession.submissions[sanctuarySession.submissions.length - 1].timestamp : 
                sanctuarySession.createdAt,
              hostToken: hostSession.hostToken,
              sessionInfo: {
                topic: sanctuarySession.topic,
                description: sanctuarySession.description,
                emoji: sanctuarySession.emoji,
                expiresAt: sanctuarySession.expiresAt
              }
            });
            
            console.log(`Host ${socket.userId} joined sanctuary host room ${sanctuaryId} with token ${hostSession.hostToken.substring(0, 8)}...`);
          } else {
            throw new Error('Sanctuary session not found or expired');
          }
        } else {
          throw new Error('Host authorization failed');
        }
      } catch (error) {
        console.error('Host authentication error:', error);
        socket.emit('sanctuary_host_auth_failed', {
          sanctuaryId,
          error: 'Not authorized as host for this sanctuary',
          details: error.message
        });
      }
    });

    socket.on('sanctuary_message', async (data) => {
      const { sanctuaryId, content, type = 'text' } = data;
      
      try {
        // Find the sanctuary session to validate and store the message
        const SanctuarySession = require('../models/SanctuarySession');
        const sanctuarySession = await SanctuarySession.findOne({
          id: sanctuaryId,
          isActive: true,
          expiresAt: { $gt: new Date() }
        });
        
        if (!sanctuarySession) {
          socket.emit('sanctuary_error', {
            error: 'Sanctuary session not found or expired'
          });
          return;
        }
        
        const message = {
          id: `sanctuary_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          participantId: socket.userId,
          participantAlias: data.participantAlias || socket.userAlias || 'Anonymous',
          content,
          type,
          timestamp: new Date().toISOString()
        };

        // Store message in database for persistence
        if (!sanctuarySession.submissions) {
          sanctuarySession.submissions = [];
        }
        sanctuarySession.submissions.push(message);
        await sanctuarySession.save();

        // Broadcast to all participants in the sanctuary
        io.to(`sanctuary_${sanctuaryId}`).emit('sanctuary_new_message', message);
        
        // Notify host with real-time submission
        io.to(`sanctuary_host_${sanctuaryId}`).emit('sanctuary_new_submission', {
          submission: message,
          totalSubmissions: sanctuarySession.submissions.length
        });
        
        console.log(`Sanctuary message stored and broadcast in ${sanctuaryId}:`, content);
      } catch (error) {
        console.error('Error handling sanctuary message:', error);
        socket.emit('sanctuary_error', {
          error: 'Failed to send message'
        });
      }
    });

    // Handle live audio room events
    socket.on('join_audio_room', (data) => {
      const { sessionId, participant } = data;
      
      socket.join(`audio_room_${sessionId}`);
      socket.currentAudioRoom = sessionId;
      
      // Notify others of participant joining
      socket.to(`audio_room_${sessionId}`).emit('audio_participant_joined', {
        participant: {
          id: socket.userId,
          alias: participant.alias || socket.userAlias || 'Anonymous',
          isHost: participant.isHost || false,
          isModerator: participant.isModerator || false,
          joinedAt: new Date().toISOString()
        }
      });
      
      console.log(`User ${socket.userId} joined audio room ${sessionId}`);
    });

    socket.on('raise_hand', (data) => {
      const { sessionId, isRaised } = data;
      
      socket.to(`audio_room_${sessionId}`).emit('hand_raised', {
        participantId: socket.userId,
        participantAlias: socket.userAlias || 'Anonymous',
        isRaised,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('promote_to_speaker', (data) => {
      const { sessionId, participantId } = data;
      
      // Find target user's socket
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === participantId);
      
      if (targetSocket) {
        targetSocket.emit('promoted_to_speaker', {
          sessionId,
          promotedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
        
        // Notify room
        io.to(`audio_room_${sessionId}`).emit('speaker_promoted', {
          participantId,
          promotedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('mute_participant', (data) => {
      const { sessionId, participantId } = data;
      
      // Find target user's socket
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === participantId);
      
      if (targetSocket) {
        targetSocket.emit('force_muted', {
          sessionId,
          mutedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
        
        // Notify room
        io.to(`audio_room_${sessionId}`).emit('participant_muted', {
          participantId,
          mutedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('kick_participant', (data) => {
      const { sessionId, participantId } = data;
      
      // Find target user's socket
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === participantId);
      
      if (targetSocket) {
        targetSocket.emit('kicked_from_room', {
          sessionId,
          kickedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
        
        targetSocket.leave(`audio_room_${sessionId}`);
        
        // Notify room
        socket.to(`audio_room_${sessionId}`).emit('participant_kicked', {
          participantId,
          kickedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('send_emoji_reaction', (data) => {
      const { sessionId, emoji } = data;
      
      socket.to(`audio_room_${sessionId}`).emit('emoji_reaction', {
        participantId: socket.userId,
        participantAlias: socket.userAlias || 'Anonymous',
        emoji,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('emergency_alert', (data) => {
      const { sessionId, alertType, message } = data;
      
      // Send to all participants and moderators
      io.to(`audio_room_${sessionId}`).emit('emergency_alert', {
        alertType,
        message,
        fromParticipant: socket.userId,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Emergency alert in ${sessionId}: ${alertType} - ${message}`);
    });

    // Handle voice chat requests
    socket.on('request_voice_chat', (data) => {
      const { targetUserId, sessionId } = data;
      
      // Find target user's socket
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === targetUserId);
      
      if (targetSocket) {
        targetSocket.emit('voice_chat_request', {
          fromUserId: socket.userId,
          fromUserAlias: socket.userAlias,
          sessionId,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('voice_chat_response', (data) => {
      const { targetUserId, accepted, sessionId } = data;
      
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === targetUserId);
      
      if (targetSocket) {
        targetSocket.emit('voice_chat_response', {
          fromUserId: socket.userId,
          fromUserAlias: socket.userAlias,
          accepted,
          sessionId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle connection quality monitoring
    socket.on('ping_sanctuary', (data) => {
      socket.emit('pong_sanctuary', {
        ...data,
        serverTime: new Date().toISOString()
      });
    });

    // Handle message read receipts for sanctuary
    socket.on('sanctuary_message_read', (data) => {
      const { sanctuaryId, messageId, hostToken } = data;
      
      // Verify host and emit read receipt
      socket.to(`sanctuary_${sanctuaryId}`).emit('sanctuary_message_status', {
        messageId,
        status: 'read',
        timestamp: new Date().toISOString()
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      
      // Leave current chat session
      if (socket.currentChatSession) {
        socket.to(`chat_${socket.currentChatSession}`).emit('user_left', {
          userId: socket.userId,
          userAlias: socket.userAlias,
          timestamp: new Date().toISOString()
        });
      }
      
      // Leave current sanctuary
      if (socket.currentSanctuary) {
        socket.to(`sanctuary_${socket.currentSanctuary}`).emit('participant_left', {
          participantId: socket.userId,
          participantAlias: socket.userAlias,
          timestamp: new Date().toISOString()
        });
      }

      // Leave current sanctuary host room
      if (socket.currentSanctuaryHost) {
        console.log(`Host ${socket.userId} left sanctuary host room ${socket.currentSanctuaryHost}`);
      }
      
      // Leave current audio room
      if (socket.currentAudioRoom) {
        socket.to(`audio_room_${socket.currentAudioRoom}`).emit('audio_participant_left', {
          participantId: socket.userId,
          participantAlias: socket.userAlias,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle message delivery confirmations
    socket.on('message_delivered', (data) => {
      const { messageId, sessionId } = data;
      socket.to(`chat_${sessionId}`).emit('message_status_update', {
        messageId,
        status: 'delivered',
        userId: socket.userId
      });
    });

    socket.on('message_read', (data) => {
      const { messageId, sessionId } = data;
      socket.to(`chat_${sessionId}`).emit('message_status_update', {
        messageId,
        status: 'read',
        userId: socket.userId
      });
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO };