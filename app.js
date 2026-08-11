require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./backend/routes/auth.routes');
const profileRoutes = require('./backend/routes/profile.routes');
const adminRoutes = require('./backend/routes/admin.routes');
const courseRoutes = require('./backend/routes/course.routes');
const workspaceRoutes = require('./backend/routes/workspace.routes');
const enrollmentRoutes = require('./backend/routes/enrollment.routes');
const aiRoutes = require('./backend/routes/aiRoutes');
const assessmentRoutes = require('./backend/routes/assessment.routes');
const courseContentRoutes = require('./backend/routes/coursecontent.routes');
const learningRoutes = require('./backend/routes/learning.routes');
const analyticsRoutes = require('./backend/routes/analytics.routes');
const infrastructureRoutes = require('./backend/routes/infrastructure.routes');
const scheduleWeeklyReports = require('./backend/cron/weeklyReport');

function createApp(io) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/courses', courseContentRoutes);
  app.use('/api/workspace', workspaceRoutes);
  app.use('/api/enrollment', enrollmentRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/assessments', assessmentRoutes);
  app.use('/api/learning', learningRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/admin/infrastructure', infrastructureRoutes);
  return app;
}

async function initializeData() {
  console.log("Initializing system data...");
  scheduleWeeklyReports();
  console.log("System data initialized.");
}

const PORT = process.env.PORT || 5000;

async function main() {
  const app = createApp();
  const server = http.createServer();
  const io = new Server(server, { cors: {origin: "*" } });

  app.set('io', io);

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
  });

  await initializeData();

  server.listen(PORT, () => {
    console.log("===================================================");
    console.log(`AcogniX Backend running at: http://localhost:${PORT}`);
    console.log("===================================================");
  });
}

main();
