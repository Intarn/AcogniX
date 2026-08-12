require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// Routes
const authRoutes = require('./backend/routes/auth.routes');
const profileRoutes = require('./backend/routes/profile.routes');
const adminRoutes = require('./backend/routes/admin.routes');
const courseRoutes = require('./backend/routes/course.routes');
const workspaceRoutes = require('./backend/routes/workspace.routes');
const enrollmentRoutes = require('./backend/routes/enrollment.routes');
const aiRoutes = require('./backend/routes/aiRoutes'); // Đảm bảo file này tồn tại
const assessmentRoutes = require('./backend/routes/assessment.routes');
const courseContentRoutes = require('./backend/routes/coursecontent.routes');
const learningRoutes = require('./backend/routes/learning.routes');
const analyticsRoutes = require('./backend/routes/analytics.routes');
const infrastructureRoutes = require('./backend/routes/infrastructure.routes');
const scheduleWeeklyReports = require('./backend/cron/weeklyReport');

function createApp(io) {
  const app = express();

  // Middlewares
  app.use(cors());
  // Sử dụng limit để cho phép upload file (cần thiết cho Workspace)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.set('io', io);

  // API Routes
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

  // Serve Frontend (SPA)
  const frontendPath = path.join(__dirname, 'dist', 'frontend');
  app.use(express.static(frontendPath));

  // Catch-all route cho React Router
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  return app;
}

async function initializeData() {
  console.log("Initializing system data...");
  scheduleWeeklyReports();
  console.log("System data initialized.");
}

const PORT = process.env.PORT || 5000;

async function main() {
  const server = http.createServer();
  const io = new Server(server, { cors: { origin: "*" } });

  const app = createApp(io); // Truyền io vào hàm createApp
  server.on('request', app);

  server.listen(PORT, () => {
    console.log("===================================================");
    console.log(`AcogniX Backend running at: http://localhost:${PORT}`);
    console.log("===================================================");
  });
}

main();