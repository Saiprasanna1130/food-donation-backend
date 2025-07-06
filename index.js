
// Main Express server setup
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./db');
const { startExpiryChecker } = require('./jobs/expiryChecker');
const Chat = require('./models/Chat');
const jwt = require('jsonwebtoken');

dotenv.config();
const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS - allow multiple frontend URLs
const io = socketIo(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:8080"
    ],
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.json());
app.use(cors());

connectDB();

// Start cron jobs
startExpiryChecker();

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User ${socket.user.name} (${socket.user.role}) connected`);

  // Join chat rooms
  socket.on('join-chat', async (chatId) => {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', 'Chat not found');
        return;
      }

      // Check if user has access to this chat
      const hasAccess = socket.user.role === 'admin' || 
        chat.participants.some(p => p.userId.toString() === socket.user.id);

      if (hasAccess) {
        socket.join(chatId);
        console.log(`User ${socket.user.name} joined chat ${chatId}`);
        socket.emit('joined-chat', chatId);
      } else {
        socket.emit('error', 'Access denied to chat');
      }
    } catch (error) {
      console.error('Error joining chat:', error);
      socket.emit('error', 'Failed to join chat');
    }
  });

  // Handle new messages
  socket.on('send-message', async (data) => {
    try {
      const { chatId, message } = data;
      
      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', 'Chat not found');
        return;
      }

      // Check if user has access to this chat
      const hasAccess = socket.user.role === 'admin' || 
        chat.participants.some(p => p.userId.toString() === socket.user.id);

      if (!hasAccess) {
        socket.emit('error', 'Access denied');
        return;
      }

      // Add message to chat
      const newMessage = {
        senderId: socket.user.id,
        senderName: socket.user.name,
        senderRole: socket.user.role,
        message,
        timestamp: new Date(),
        read: [{ userId: socket.user.id }] // Mark as read by sender
      };

      chat.messages.push(newMessage);
      chat.lastActivity = new Date();
      await chat.save();

      // Emit message to all users in the chat room
      io.to(chatId).emit('new-message', {
        chatId,
        message: newMessage
      });

      console.log(`Message sent in chat ${chatId} by ${socket.user.name}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', 'Failed to send message');
    }
  });

  // Handle admin joining chat
  socket.on('admin-join-chat', async (chatId) => {
    try {
      if (socket.user.role !== 'admin') {
        socket.emit('error', 'Admin access required');
        return;
      }

      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', 'Chat not found');
        return;
      }

      // Add admin as participant if not already
      const isParticipant = chat.participants.some(p => 
        p.userId.toString() === socket.user.id
      );

      if (!isParticipant) {
        chat.participants.push({ 
          userId: socket.user.id, 
          role: 'admin' 
        });
        await chat.save();
      }

      socket.join(chatId);
      
      // Notify other participants that admin joined
      socket.to(chatId).emit('admin-joined', {
        adminName: socket.user.name,
        message: `Admin ${socket.user.name} joined the chat for moderation`
      });

      console.log(`Admin ${socket.user.name} joined chat ${chatId}`);
    } catch (error) {
      console.error('Error with admin joining chat:', error);
      socket.emit('error', 'Failed to join as admin');
    }
  });

  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });

  socket.on('disconnect', (reason) => {
    console.log(`User ${socket.user.name} disconnected: ${reason}`);
  });

  socket.on('error', (error) => {
    console.error(`Socket error for user ${socket.user.name}:`, error);
  });
});

// Routes
app.get('/', (req, res) => res.send('Food Donation API is running!'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/chat', require('./routes/chat'));

// 404 Handler
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Backend server started on port ${PORT}`));
