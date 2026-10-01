require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const Database = require('./database/connection');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (_) { next(new Error('Invalid authentication token')); }
});

// Pass io to request object
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.resolve(__dirname, process.env.DB_PATH || './database/emergency.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (!fs.existsSync(dbPath)) execFileSync(process.execPath, [path.join(__dirname, 'database', 'init.js')], { cwd: __dirname, env: process.env, stdio: 'inherit' });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Pass db to request object
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Import Routes
const authRoutes = require('./routes/auth');
const hospitalRoutes = require('./routes/hospitals');
const emergencyRoutes = require('./routes/emergencies');
const doctorRoutes = require('./routes/doctors');
const ambulanceRoutes = require('./routes/ambulances');
const messageRoutes = require('./routes/messages');
const transferRoutes = require('./routes/transfers');
const adminRoutes = require('./routes/admin');
const syncRoutes = require('./routes/sync');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/emergencies', emergencyRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sync', syncRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'CareLink', time: new Date().toISOString() }));

// Socket handler
const socketHandler = require('./socket/handler');
io.on('connection', (socket) => {
  socketHandler(io, socket, db);
});

// Static app is served by express.static; return its entry point for browser requests.
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
