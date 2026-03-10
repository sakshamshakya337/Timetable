/**
 * server.js
 * LPU Timetable Generation Backend — v2
 * Robust, Excel-agnostic scheduling engine
 *
 * Start: node server.js
 * Dev:   nodemon server.js
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const timetableRoutes = require('./routes/timetable');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'LPU Timetable Backend v2',
    time:    new Date().toISOString(),
  });
});

// ── Timetable routes ──────────────────────────────────────────────────────────
app.use('/api/timetable', timetableRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `${req.path} not found` }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 20MB.' });
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n✅  LPU Timetable Backend v2  →  http://localhost:${PORT}`);
  console.log(`\n  UPLOAD:   POST /api/timetable/upload         (multipart, field: "excel")`);
  console.log(`  PROGRAMS: GET  /api/timetable/programs`);
  console.log(`  COURSES:  GET  /api/timetable/courses?program=P123&year=1`);
  console.log(`  GENERATE: POST /api/timetable/generate`);
  console.log(`  BULK:     POST /api/timetable/generate/bulk`);
  console.log(`  SUMMARY:  GET  /api/timetable/summary\n`);
});

module.exports = app;
