require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Timetable Backend', time: new Date().toISOString() });
});

// Load routes with error handling
try {
  const timetableRoutes = require('./routes/timetableRoutes');
  app.use('/timetable', timetableRoutes);
  console.log('✓ Timetable routes loaded successfully');
} catch (error) {
  console.error('✗ Failed to load timetable routes:', error.message);
  console.error('Stack:', error.stack);
  
  // Create a fallback route that returns the error
  app.use('/timetable', (req, res) => {
    res.status(500).json({ 
      error: 'Timetable routes failed to load', 
      message: error.message,
      hint: 'Check if all required modules (excelParser, scheduler, firebase) are properly configured'
    });
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  res.status(500).json({ 
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit, keep server running
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit, keep server running
});

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Timetable Backend initialized`);
  console.log(`   Port:     ${PORT}`);
  console.log(`   Health:   GET http://localhost:${PORT}/health`);
  console.log(`   API:      http://localhost:${PORT}/timetable/programs`);
  console.log(`   Status:   Server is running and ready\n`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please:`);
    console.error(`   1. Stop the other process using port ${PORT}`);
    console.error(`   2. Or change PORT in .env file`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

module.exports = app;
