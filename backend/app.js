const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const adminRoutes = require('./routes/admin.routes');
const authRoutes = require('./routes/auth.routes');
const courseRoutes = require('./routes/course.routes');
const enrollmentRoutes = require('./routes/enrollment.routes');
const profileRoutes = require('./routes/profile.routes');
const workspaceRoutes = require('./routes/workspace.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/workspace', workspaceRoutes);


app.get('/', (req, res) => {
    res.send('AcogniX Backend is running!');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});