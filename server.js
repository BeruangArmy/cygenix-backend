require('dotenv').config();
const express = require('express');
const cors = require('cors');

const modulesRoutes = require('./src/routes/modules');
const lessonsRoutes = require('./src/routes/lessons');
const quizStateRoutes = require('./src/routes/quizState');
const challengesRoutes = require('./src/routes/challenges');
const leaderboardRoutes = require('./src/routes/leaderboard');
const progressRoutes = require('./src/routes/progress');
const adminRoutes = require('./src/routes/admin');
const notificationsRoutes = require('./src/routes/notifications');
const loopRoutes = require('./src/routes/loop');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, service: 'cygenix-backend' }));

app.use(modulesRoutes);
app.use(lessonsRoutes);
app.use(quizStateRoutes);
app.use(challengesRoutes);
app.use(leaderboardRoutes);
app.use(progressRoutes);
app.use(adminRoutes);
app.use(notificationsRoutes);
app.use(loopRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`cygenix-backend listening on http://localhost:${PORT}`);
});
