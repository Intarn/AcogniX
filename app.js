require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./backend/routes/auth.routes');
const workspaceRoutes = require('./backend/routes/workspace.routes');
const enrollmentRoutes = require('./backend/routes/enrollment.routes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/workspace', workspaceRoutes)
  app.use('/api/enrollment', enrollmentRoutes);
  app.get('/', (req, res) => {
    res.send('AcogniX Backend is running!');
  });
  return app;
}

async function initializeData() {
  console.log("Initializing system data...");
  console.log("System data initialized.");
}

const PORT = process.env.PORT || 3001;

async function main() {
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  io.on('connection', (socket) => {
    
  });

  await initializeData();

  server.listen(PORT, () => {
    console.log("===================================================");
    console.log(`AcogniX Backend running at: http://localhost:${PORT}`);
    console.log("===================================================");
  });
}

main();