/**
 * server.js  –  LPU Timetable Generation Backend
 * Node.js + Express
 *
 * Start: node server.js
 * Dev:   nodemon server.js
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const timetableRoutes = require('./routes/timetable');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'LPU Timetable Generator', time: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/timetable', timetableRoutes);

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ LPU Timetable Backend running on http://localhost:${PORT}`);
  console.log(`   Health:   GET  /health`);
  console.log(`   Programs: GET  /api/timetable/programs`);
  console.log(`   Courses:  GET  /api/timetable/courses?program=P123&year=1`);
  console.log(`   Generate: POST /api/timetable/generate\n`);
});

module.exports = app;
